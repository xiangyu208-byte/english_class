#pragma once

#include <string>
#include <vector>
#include <random>
#include <algorithm>
#include "repositories/word-repository.hpp"
#include "repositories/record-repository.hpp"
#include "json.hpp"

using json = nlohmann::json;

/**
 * @brief 测试与统计服务
 * 处理随机抽词测试、答案验证、学习进度和正确率计算
 */
class TestService {
public:
    TestService(WordRepository& wordRepo, RecordRepository& recordRepo)
        : wordRepo_(wordRepo), recordRepo_(recordRepo) {}

    /**
     * @brief 随机获取一个单词用于测试
     * @return 随机单词的 JSON 对象（不含中文释义，用于学生答题）
     */
    json getRandomWord() {
        auto words = wordRepo_.findAll();
        if (words.empty()) {
            return {{"error", "No words available"}};
        }

        // 使用随机数生成器
        std::random_device rd;
        std::mt19937 gen(rd());
        std::uniform_int_distribution<size_t> dist(0, words.size() - 1);

        const auto& word = words[dist(gen)];
        return {
            {"id", word.id},
            {"english", word.english},
            {"example", word.example},
            {"letter", word.getLetter()}
        };
    }

    /**
     * @brief 提交测试答案并记录结果
     * @param userId 用户 ID
     * @param wordId 单词 ID
     * @param answer 用户输入的答案
     * @return 包含正确与否和正确答案的 JSON
     */
    json submitAnswer(const std::string& userId,
                      const std::string& wordId,
                      const std::string& answer) {
        auto word = wordRepo_.findById(wordId);
        if (!word.has_value()) {
            return {{"error", "Word not found"}};
        }

        // 判断答案是否正确：用户答案包含在中文释义中，或中文释义包含在用户答案中
        bool isCorrect = word->chinese.find(answer) != std::string::npos ||
                         answer.find(word->chinese) != std::string::npos;
        // 也支持精确匹配
        if (!isCorrect) {
            // 去掉末尾的标点符号做比较
            std::string cleanChinese = word->chinese;
            while (!cleanChinese.empty() &&
                   (cleanChinese.back() == '.' || cleanChinese.back() == ',' ||
                    cleanChinese.back() == ';')) {
                cleanChinese.pop_back();
            }
            // 简单中文标点：。、，
            // NOTE: UTF-8 中文标点是多字节，这里做简单包含匹配即可
            isCorrect = cleanChinese.find(answer) != std::string::npos ||
                        answer.find(cleanChinese) != std::string::npos;
        }

        // 记录测试结果
        TestRecord record;
        record.userId = userId;
        record.wordId = wordId;
        record.isCorrect = isCorrect;
        recordRepo_.create(record);

        return {
            {"isCorrect", isCorrect},
            {"correctAnswer", word->chinese},
            {"word", word->english}
        };
    }

    /**
     * @brief 获取指定用户的学习统计
     * @param userId 用户 ID
     * @return 统计数据 JSON
     */
    json getUserStats(const std::string& userId) {
        auto records = recordRepo_.findByUserId(userId);
        size_t total = records.size();
        size_t correct = 0;
        for (const auto& r : records) {
            if (r.isCorrect) ++correct;
        }

        double accuracy = total > 0 ? (static_cast<double>(correct) / total * 100.0) : 0.0;

        // 计算已掌握的单词数（正确回答过的不同单词）
        std::vector<std::string> masteredWords;
        for (const auto& r : records) {
            if (r.isCorrect) {
                if (std::find(masteredWords.begin(), masteredWords.end(), r.wordId) == masteredWords.end()) {
                    masteredWords.push_back(r.wordId);
                }
            }
        }

        // 计算连续正确数
        int streak = 0;
        for (int i = static_cast<int>(records.size()) - 1; i >= 0; --i) {
            if (records[i].isCorrect) {
                ++streak;
            } else {
                break;
            }
        }

        return {
            {"totalTests", total},
            {"correctCount", correct},
            {"accuracy", std::round(accuracy * 10) / 10},
            {"masteredCount", masteredWords.size()},
            {"streak", streak}
        };
    }

    /**
     * @brief 获取仪表盘统计数据
     * @param userId 用户 ID（当前用户）
     * @param isAdmin 是否管理员
     * @return 仪表盘统计 JSON
     */
    json getDashboardStats(const std::string& userId, bool isAdmin) {
        auto allRecords = recordRepo_.findAll();
        size_t totalWords = wordRepo_.count();

        json stats;
        stats["totalWords"] = totalWords;

        if (isAdmin) {
            // 管理员看全局统计
            size_t totalCorrect = 0;
            for (const auto& r : allRecords) {
                if (r.isCorrect) ++totalCorrect;
            }
            stats["totalTests"] = allRecords.size();
            stats["totalCorrect"] = totalCorrect;
            stats["globalAccuracy"] = allRecords.empty() ? 0.0 :
                std::round(static_cast<double>(totalCorrect) / allRecords.size() * 1000.0) / 10.0;
        }

        // 个人统计
        auto userStats = getUserStats(userId);
        stats["userStats"] = userStats;

        // 最近添加的词
        auto words = wordRepo_.findAll();
        json recentWords = json::array();
        std::sort(words.begin(), words.end(), [](const Word& a, const Word& b) {
            try { return std::stoi(a.id) > std::stoi(b.id); }
            catch (...) { return a.id > b.id; }
        });
        size_t limit = std::min(words.size(), static_cast<size_t>(3));
        for (size_t i = 0; i < limit; ++i) {
            recentWords.push_back(words[i].toJson());
        }
        stats["recentWords"] = recentWords;

        // 每日一词（取一个随机词）
        if (!words.empty()) {
            // 基于日期的伪随机选择
            auto now = std::chrono::system_clock::now();
            auto days = std::chrono::duration_cast<std::chrono::hours>(now.time_since_epoch()).count() / 24;
            size_t idx = days % words.size();
            stats["wordOfDay"] = words[idx].toJson();
        }

        return stats;
    }

private:
    WordRepository& wordRepo_;
    RecordRepository& recordRepo_;
};
