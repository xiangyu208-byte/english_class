#pragma once

#include <string>
#include <optional>
#include <stdexcept>
#include "repositories/user-repository.hpp"

/**
 * @brief 认证服务
 * 处理用户注册、登录等认证相关业务逻辑
 */
class AuthService {
public:
    explicit AuthService(UserRepository& userRepo) : userRepo_(userRepo) {}

    /**
     * @brief 用户注册
     * @param username 用户名
     * @param password 密码
     * @param email 邮箱
     * @param role 角色（student/admin）
     * @param name 显示名称
     * @return 注册成功的用户对象
     * @throws std::runtime_error 用户名已存在时抛出
     */
    User registerUser(const std::string& username,
                      const std::string& password,
                      const std::string& email,
                      const std::string& role,
                      const std::string& name) {
        // 检查用户名是否已存在
        auto existing = userRepo_.findByUsername(username);
        if (existing.has_value()) {
            throw std::runtime_error("Username already exists");
        }

        User user;
        user.username = username;
        user.passwordHash = User::hashPassword(password);
        user.email = email;
        user.role = (role == "admin") ? "admin" : "student";
        user.name = name.empty() ? username : name;
        user.avatar = "https://picsum.photos/seed/" + username + "/100/100";

        return userRepo_.create(user);
    }

    /**
     * @brief 用户登录
     * @param username 用户名
     * @param password 密码
     * @return 登录成功的用户对象
     * @throws std::runtime_error 用户名或密码错误时抛出
     */
    User login(const std::string& username, const std::string& password) {
        auto user = userRepo_.findByUsername(username);
        if (!user.has_value()) {
            throw std::runtime_error("Invalid username or password");
        }

        if (!user->verifyPassword(password)) {
            throw std::runtime_error("Invalid username or password");
        }

        return user.value();
    }

    /**
     * @brief 修改密码
     * @param userId 用户 ID
     * @param oldPassword 旧密码
     * @param newPassword 新密码
     * @throws std::runtime_error 用户不存在或旧密码错误时抛出
     */
    void changePassword(const std::string& userId,
                        const std::string& oldPassword,
                        const std::string& newPassword) {
        auto user = userRepo_.findById(userId);
        if (!user.has_value()) {
            throw std::runtime_error("User not found");
        }

        if (!user->verifyPassword(oldPassword)) {
            throw std::runtime_error("Current password is incorrect");
        }

        user->passwordHash = User::hashPassword(newPassword);
        userRepo_.update(user.value());
    }

private:
    UserRepository& userRepo_;
};
