#pragma once

#include <string>
#include <algorithm>
#include <cctype>
#include "repositories/word-repository.hpp"
#include "json.hpp"

using json = nlohmann::json;

/**
 * @brief 单词接龙游戏服务
 * 验证接龙单词是否符合规则
 */
class GameService {
public:
    explicit GameService(WordRepository& wordRepo) : wordRepo_(wordRepo) {}

    /**
     * @brief 验证接龙单词是否有效
     * 规则：1. 长度 >= 4  2. 首字母与上一个单词末字母一致  3. 在词库中存在（可选）
     * @param currentWord 当前单词（上一个）
     * @param inputWord 用户输入的接龙单词
     * @return 验证结果 JSON
     */
    json validateWord(const std::string& currentWord, const std::string& inputWord) {
        // 规则1：长度检查
        if (inputWord.length() < 4) {
            return {
                {"valid", false},
                {"reason", "Word must be at least 4 characters long"}
            };
        }

        // 规则2：首尾字母匹配
        if (currentWord.empty()) {
            return {
                {"valid", false},
                {"reason", "No current word to chain from"}
            };
        }

        char lastLetter = std::toupper(static_cast<unsigned char>(currentWord.back()));
        char firstLetter = std::toupper(static_cast<unsigned char>(inputWord.front()));

        if (lastLetter != firstLetter) {
            return {
                {"valid", false},
                {"reason", "First letter must match the last letter of the current word"},
                {"expected", std::string(1, lastLetter)},
                {"got", std::string(1, firstLetter)}
            };
        }

        // 验证通过
        // 额外检查是否在词库中（加分项）
        bool inDictionary = false;
        auto words = wordRepo_.findAll();
        std::string lowerInput = inputWord;
        std::transform(lowerInput.begin(), lowerInput.end(), lowerInput.begin(),
            [](unsigned char c) { return std::tolower(c); });

        for (const auto& word : words) {
            std::string lowerWord = word.english;
            std::transform(lowerWord.begin(), lowerWord.end(), lowerWord.begin(),
                [](unsigned char c) { return std::tolower(c); });
            if (lowerWord == lowerInput) {
                inDictionary = true;
                break;
            }
        }

        // 计算分数：基础 500 分，在词库中额外 200 分
        int score = 500;
        if (inDictionary) score += 200;

        return {
            {"valid", true},
            {"word", inputWord},
            {"inDictionary", inDictionary},
            {"score", score}
        };
    }

private:
    WordRepository& wordRepo_;
};
