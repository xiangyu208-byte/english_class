#pragma once

#include <string>
#include <vector>
#include <mutex>
#include "models/word.hpp"
#include "utils/csv-helper.hpp"

/**
 * @brief 测试记录数据仓库
 * 封装对 test_records.csv 的读写操作
 */
class RecordRepository {
public:
    explicit RecordRepository(const std::string& dataDir)
        : filePath_(dataDir + "/test_records.csv") {
        CsvHelper::ensureFile(filePath_, HEADER);
    }

    /**
     * @brief 获取所有测试记录
     * @return 记录列表
     */
    std::vector<TestRecord> findAll() {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        std::vector<TestRecord> records;
        for (const auto& row : rows) {
            records.push_back(TestRecord::fromCsvFields(row));
        }
        return records;
    }

    /**
     * @brief 获取指定用户的所有测试记录
     * @param userId 用户 ID
     * @return 该用户的记录列表
     */
    std::vector<TestRecord> findByUserId(const std::string& userId) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        std::vector<TestRecord> records;
        for (const auto& row : rows) {
            if (row.size() >= 2 && row[1] == userId) {
                records.push_back(TestRecord::fromCsvFields(row));
            }
        }
        return records;
    }

    /**
     * @brief 创建新的测试记录
     * @param record 记录对象
     * @return 创建后的记录（含自动 ID）
     */
    TestRecord create(TestRecord record) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        record.id = CsvHelper::nextId(rows);
        record.answeredAt = CsvHelper::nowString();
        CsvHelper::appendLine(filePath_, record.toCsvLine());
        return record;
    }

    /**
     * @brief 计算指定用户的总记录数
     * @param userId 用户 ID
     * @return 记录数
     */
    size_t countByUserId(const std::string& userId) {
        return findByUserId(userId).size();
    }

    /**
     * @brief 计算指定用户的正确记录数
     * @param userId 用户 ID
     * @return 正确的记录数
     */
    size_t countCorrectByUserId(const std::string& userId) {
        auto records = findByUserId(userId);
        size_t count = 0;
        for (const auto& r : records) {
            if (r.isCorrect) ++count;
        }
        return count;
    }

private:
    std::string filePath_;
    std::mutex mutex_;
    static constexpr const char* HEADER = "id,user_id,word_id,is_correct,answered_at";
};
