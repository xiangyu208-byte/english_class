#pragma once

#include <string>
#include <vector>
#include <mutex>
#include <optional>
#include <algorithm>
#include "models/word.hpp"
#include "utils/csv-helper.hpp"

/**
 * @brief 词库数据仓库
 * 封装对 words.csv 的所有读写操作，线程安全
 */
class WordRepository {
public:
    explicit WordRepository(const std::string& dataDir)
        : filePath_(dataDir + "/words.csv") {
        CsvHelper::ensureFile(filePath_, HEADER);
    }

    /**
     * @brief 获取所有单词
     * @return 单词列表
     */
    std::vector<Word> findAll() {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        std::vector<Word> words;
        for (const auto& row : rows) {
            words.push_back(Word::fromCsvFields(row));
        }
        return words;
    }

    /**
     * @brief 根据 ID 查找单词
     * @param id 单词 ID
     * @return 单词对象（可选）
     */
    std::optional<Word> findById(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        for (const auto& row : rows) {
            if (!row.empty() && row[0] == id) {
                return Word::fromCsvFields(row);
            }
        }
        return std::nullopt;
    }

    /**
     * @brief 搜索单词（支持英文和中文模糊搜索）
     * @param query 搜索关键词
     * @return 匹配的单词列表
     */
    std::vector<Word> search(const std::string& query) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        std::vector<Word> results;

        // 搜索关键词转小写（仅用于英文比较）
        std::string lowerQuery = query;
        std::transform(lowerQuery.begin(), lowerQuery.end(), lowerQuery.begin(), ::tolower);

        for (const auto& row : rows) {
            Word word = Word::fromCsvFields(row);
            std::string lowerEnglish = word.english;
            std::transform(lowerEnglish.begin(), lowerEnglish.end(), lowerEnglish.begin(), ::tolower);

            if (lowerEnglish.find(lowerQuery) != std::string::npos ||
                word.chinese.find(query) != std::string::npos) {
                results.push_back(word);
            }
        }
        return results;
    }

    /**
     * @brief 创建新单词
     * @param word 单词对象
     * @return 创建后的单词对象（含自动生成的 ID）
     */
    Word create(Word word) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        word.id = CsvHelper::nextId(rows);
        word.createdAt = CsvHelper::nowString();
        if (word.status.empty()) word.status = "new";
        CsvHelper::appendLine(filePath_, word.toCsvLine());
        return word;
    }

    /**
     * @brief 更新单词信息
     * @param word 更新后的单词对象
     * @return 是否更新成功
     */
    bool update(const Word& word) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        std::vector<std::string> lines;
        bool found = false;

        for (const auto& row : rows) {
            if (!row.empty() && row[0] == word.id) {
                lines.push_back(word.toCsvLine());
                found = true;
            } else {
                Word existing = Word::fromCsvFields(row);
                lines.push_back(existing.toCsvLine());
            }
        }

        if (found) {
            CsvHelper::writeAll(filePath_, HEADER, lines);
        }
        return found;
    }

    /**
     * @brief 删除单词
     * @param id 单词 ID
     * @return 是否删除成功
     */
    bool remove(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        std::vector<std::string> lines;
        bool found = false;

        for (const auto& row : rows) {
            if (!row.empty() && row[0] == id) {
                found = true;
            } else {
                Word existing = Word::fromCsvFields(row);
                lines.push_back(existing.toCsvLine());
            }
        }

        if (found) {
            CsvHelper::writeAll(filePath_, HEADER, lines);
        }
        return found;
    }

    /**
     * @brief 获取单词总数
     * @return 单词数量
     */
    size_t count() {
        std::lock_guard<std::mutex> lock(mutex_);
        return CsvHelper::readAll(filePath_).size();
    }

private:
    std::string filePath_;
    std::mutex mutex_;
    static constexpr const char* HEADER = "id,english,chinese,example,status,created_by,created_at";
};
