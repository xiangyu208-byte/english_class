#pragma once

#include <string>
#include "json.hpp"

using json = nlohmann::json;

/**
 * @brief 单词数据模型
 * 存储英文单词、中文释义、例句和学习状态
 */
struct Word {
    std::string id;
    std::string english;
    std::string chinese;
    std::string example;
    std::string status;     // "new", "learning", "mastered"
    std::string createdBy;  // 创建者用户 ID
    std::string createdAt;

    /**
     * @brief 获取单词的首字母（大写）
     * @return 首字母字符串
     */
    std::string getLetter() const {
        if (english.empty()) return "";
        char c = english[0];
        if (c >= 'a' && c <= 'z') c -= 32;
        return std::string(1, c);
    }

    /**
     * @brief 将单词序列化为 JSON
     * @return JSON 对象
     */
    json toJson() const {
        return {
            {"id", id},
            {"english", english},
            {"chinese", chinese},
            {"example", example},
            {"status", status},
            {"letter", getLetter()},
            {"createdBy", createdBy},
            {"createdAt", createdAt}
        };
    }

    /**
     * @brief 序列化为 CSV 行
     * NOTE: example 字段可能包含逗号，使用双引号包裹
     * @return CSV 格式字符串
     */
    std::string toCsvLine() const {
        return id + "," + english + "," + chinese + ",\"" +
               example + "\"," + status + "," + createdBy + "," + createdAt;
    }

    /**
     * @brief 从 CSV 字段数组解析单词对象
     * @param fields CSV 字段数组（至少 7 个字段）
     * @return Word 对象
     */
    static Word fromCsvFields(const std::vector<std::string>& fields) {
        Word w;
        if (fields.size() >= 7) {
            w.id = fields[0];
            w.english = fields[1];
            w.chinese = fields[2];
            w.example = fields[3];
            w.status = fields[4];
            w.createdBy = fields[5];
            w.createdAt = fields[6];
        }
        return w;
    }
};

/**
 * @brief 测试记录数据模型
 * 记录用户每次测试的答题结果
 */
struct TestRecord {
    std::string id;
    std::string userId;
    std::string wordId;
    bool isCorrect;
    std::string answeredAt;

    json toJson() const {
        return {
            {"id", id},
            {"userId", userId},
            {"wordId", wordId},
            {"isCorrect", isCorrect},
            {"answeredAt", answeredAt}
        };
    }

    std::string toCsvLine() const {
        return id + "," + userId + "," + wordId + "," +
               (isCorrect ? "true" : "false") + "," + answeredAt;
    }

    static TestRecord fromCsvFields(const std::vector<std::string>& fields) {
        TestRecord r;
        if (fields.size() >= 5) {
            r.id = fields[0];
            r.userId = fields[1];
            r.wordId = fields[2];
            r.isCorrect = (fields[3] == "true");
            r.answeredAt = fields[4];
        }
        return r;
    }
};
