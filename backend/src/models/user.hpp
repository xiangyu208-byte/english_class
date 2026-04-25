#pragma once

#include <string>
#include <functional>
#include "json.hpp"

using json = nlohmann::json;

/**
 * @brief 用户数据模型
 * 存储用户的基本信息、认证凭据和角色
 */
struct User {
    std::string id;
    std::string username;
    std::string passwordHash;
    std::string email;
    std::string role;       // "admin" 或 "student"
    std::string name;
    std::string avatar;
    std::string createdAt;

    /**
     * @brief 将用户对象序列化为 JSON（不包含密码哈希）
     * @return JSON 对象
     */
    json toJson() const {
        return {
            {"id", id},
            {"username", username},
            {"email", email},
            {"role", role},
            {"name", name},
            {"avatar", avatar},
            {"createdAt", createdAt}
        };
    }

    /**
     * @brief 序列化为 CSV 行
     * @return CSV 格式字符串
     */
    std::string toCsvLine() const {
        return id + "," + username + "," + passwordHash + "," +
               email + "," + role + "," + name + "," +
               avatar + "," + createdAt;
    }

    /**
     * @brief 从 CSV 字段数组解析用户对象
     * @param fields CSV 字段数组（至少 8 个字段）
     * @return User 对象
     */
    static User fromCsvFields(const std::vector<std::string>& fields) {
        User u;
        if (fields.size() >= 8) {
            u.id = fields[0];
            u.username = fields[1];
            u.passwordHash = fields[2];
            u.email = fields[3];
            u.role = fields[4];
            u.name = fields[5];
            u.avatar = fields[6];
            u.createdAt = fields[7];
        }
        return u;
    }

    /**
     * @brief 简单密码哈希（仅用于演示，非生产级别）
     * @param password 明文密码
     * @return 哈希字符串
     */
    static std::string hashPassword(const std::string& password) {
        std::hash<std::string> hasher;
        return std::to_string(hasher(password));
    }

    /**
     * @brief 验证密码是否匹配
     * @param password 明文密码
     * @return 是否匹配
     */
    bool verifyPassword(const std::string& password) const {
        return passwordHash == hashPassword(password);
    }
};
