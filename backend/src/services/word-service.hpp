#pragma once

#include <string>
#include <vector>
#include <optional>
#include "repositories/word-repository.hpp"

/**
 * @brief 单词服务
 * 处理单词 CRUD 相关业务逻辑
 */
class WordService {
public:
    explicit WordService(WordRepository& wordRepo) : wordRepo_(wordRepo) {}

    /**
     * @brief 获取所有单词
     * @return 单词列表
     */
    std::vector<Word> getAllWords() {
        return wordRepo_.findAll();
    }

    /**
     * @brief 搜索单词
     * @param query 搜索关键词
     * @return 匹配的单词列表
     */
    std::vector<Word> searchWords(const std::string& query) {
        if (query.empty()) {
            return wordRepo_.findAll();
        }
        return wordRepo_.search(query);
    }

    /**
     * @brief 根据 ID 获取单词
     * @param id 单词 ID
     * @return 单词对象（可选）
     */
    std::optional<Word> getWordById(const std::string& id) {
        return wordRepo_.findById(id);
    }

    /**
     * @brief 添加新单词
     * @param english 英文
     * @param chinese 中文释义
     * @param example 例句
     * @param createdBy 创建者 ID
     * @return 创建后的单词对象
     */
    Word addWord(const std::string& english,
                 const std::string& chinese,
                 const std::string& example,
                 const std::string& createdBy) {
        Word word;
        word.english = english;
        word.chinese = chinese;
        word.example = example;
        word.status = "new";
        word.createdBy = createdBy;
        return wordRepo_.create(word);
    }

    /**
     * @brief 更新单词
     * @param id 单词 ID
     * @param english 英文
     * @param chinese 中文释义
     * @param example 例句
     * @param status 状态
     * @return 是否更新成功
     */
    bool updateWord(const std::string& id,
                    const std::string& english,
                    const std::string& chinese,
                    const std::string& example,
                    const std::string& status) {
        auto existing = wordRepo_.findById(id);
        if (!existing.has_value()) return false;

        Word word = existing.value();
        if (!english.empty()) word.english = english;
        if (!chinese.empty()) word.chinese = chinese;
        if (!example.empty()) word.example = example;
        if (!status.empty()) word.status = status;

        return wordRepo_.update(word);
    }

    /**
     * @brief 删除单词
     * @param id 单词 ID
     * @return 是否删除成功
     */
    bool deleteWord(const std::string& id) {
        return wordRepo_.remove(id);
    }

    /**
     * @brief 获取单词总数
     * @return 数量
     */
    size_t getWordCount() {
        return wordRepo_.count();
    }

    /**
     * @brief 获取最近添加的单词
     * @param limit 数量限制
     * @return 单词列表（最新的排在前面）
     */
    std::vector<Word> getRecentWords(size_t limit) {
        auto words = wordRepo_.findAll();
        // 按 ID 降序排列（ID 越大越新）
        std::sort(words.begin(), words.end(), [](const Word& a, const Word& b) {
            try {
                return std::stoi(a.id) > std::stoi(b.id);
            } catch (...) {
                return a.id > b.id;
            }
        });
        if (words.size() > limit) {
            words.resize(limit);
        }
        return words;
    }

private:
    WordRepository& wordRepo_;
};
