#pragma once

#include <string>
#include <vector>
#include <mutex>
#include <optional>
#include <algorithm>
#include "models/user.hpp"
#include "utils/csv-helper.hpp"

/**
 * @brief 用户数据仓库
 * 封装对 users.csv 的所有读写操作，线程安全
 */
class UserRepository {
public:
    explicit UserRepository(const std::string& dataDir)
        : filePath_(dataDir + "/users.csv") {
        CsvHelper::ensureFile(filePath_, HEADER);
    }

    /**
     * @brief 获取所有用户
     * @return 用户列表
     */
    std::vector<User> findAll() {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        std::vector<User> users;
        for (const auto& row : rows) {
            users.push_back(User::fromCsvFields(row));
        }
        return users;
    }

    /**
     * @brief 根据 ID 查找用户
     * @param id 用户 ID
     * @return 用户对象（可选）
     */
    std::optional<User> findById(const std::string& id) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        for (const auto& row : rows) {
            if (!row.empty() && row[0] == id) {
                return User::fromCsvFields(row);
            }
        }
        return std::nullopt;
    }

    /**
     * @brief 根据用户名查找用户
     * @param username 用户名
     * @return 用户对象（可选）
     */
    std::optional<User> findByUsername(const std::string& username) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        for (const auto& row : rows) {
            if (row.size() >= 2 && row[1] == username) {
                return User::fromCsvFields(row);
            }
        }
        return std::nullopt;
    }

    /**
     * @brief 创建新用户
     * @param user 用户对象（id 和 createdAt 会自动生成）
     * @return 创建后的用户对象
     */
    User create(User user) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        user.id = CsvHelper::nextId(rows);
        user.createdAt = CsvHelper::nowString();
        CsvHelper::appendLine(filePath_, user.toCsvLine());
        return user;
    }

    /**
     * @brief 更新用户信息
     * @param user 更新后的用户对象
     * @return 是否更新成功
     */
    bool update(const User& user) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto rows = CsvHelper::readAll(filePath_);
        std::vector<std::string> lines;
        bool found = false;

        for (const auto& row : rows) {
            if (!row.empty() && row[0] == user.id) {
                lines.push_back(user.toCsvLine());
                found = true;
            } else {
                User existing = User::fromCsvFields(row);
                lines.push_back(existing.toCsvLine());
            }
        }

        if (found) {
            CsvHelper::writeAll(filePath_, HEADER, lines);
        }
        return found;
    }

    /**
     * @brief 获取用户总数
     * @return 用户数量
     */
    size_t count() {
        std::lock_guard<std::mutex> lock(mutex_);
        return CsvHelper::readAll(filePath_).size();
    }

private:
    std::string filePath_;
    std::mutex mutex_;
    static constexpr const char* HEADER = "id,username,password_hash,email,role,name,avatar,created_at";
};
