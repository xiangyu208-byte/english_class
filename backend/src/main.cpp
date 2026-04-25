/**
 * @brief 词汇圣殿后端服务入口
 *
 * 使用 cpp-httplib 提供 REST API 服务
 * 所有数据存储在 CSV 文件中，通过 C++ 文件流读写
 */

#include <iostream>
#include <string>
#include <filesystem>

#include "httplib.h"
#include "json.hpp"

#include "repositories/user-repository.hpp"
#include "repositories/word-repository.hpp"
#include "repositories/record-repository.hpp"
#include "services/auth-service.hpp"
#include "services/word-service.hpp"
#include "services/test-service.hpp"
#include "services/game-service.hpp"

using json = nlohmann::json;

/**
 * @brief 从请求体解析 JSON
 * @param req HTTP 请求
 * @return 解析后的 JSON 对象
 */
json parseBody(const httplib::Request& req) {
    try {
        if (!req.body.empty()) {
            return json::parse(req.body);
        }
    } catch (...) {}
    return json::object();
}

/**
 * @brief 返回 JSON 成功响应
 * @param res HTTP 响应
 * @param data 响应数据
 * @param statusCode HTTP 状态码
 */
void jsonResponse(httplib::Response& res, const json& data, int statusCode = 200) {
    res.status = statusCode;
    res.set_header("Content-Type", "application/json; charset=utf-8");
    res.body = data.dump(-1, ' ', false, json::error_handler_t::replace);
}

/**
 * @brief 返回 JSON 错误响应
 * @param res HTTP 响应
 * @param message 错误消息
 * @param statusCode HTTP 状态码
 */
void errorResponse(httplib::Response& res, const std::string& message, int statusCode = 400) {
    json err = {{"error", message}};
    jsonResponse(res, err, statusCode);
}

int main() {
    // 确定数据目录路径（相对于可执行文件位置）
    std::string dataDir = "./data";
    auto exePath = std::filesystem::current_path();

    // 如果在 build 目录中运行，数据目录在上一层
    if (!std::filesystem::exists(dataDir)) {
        dataDir = "../data";
    }
    if (!std::filesystem::exists(dataDir)) {
        std::filesystem::create_directories("./data");
        dataDir = "./data";
    }

    std::cout << "[Lexical Sanctuary] Data directory: "
              << std::filesystem::absolute(dataDir) << std::endl;

    // 初始化仓库
    UserRepository userRepo(dataDir);
    WordRepository wordRepo(dataDir);
    RecordRepository recordRepo(dataDir);

    // 初始化服务
    AuthService authService(userRepo);
    WordService wordService(wordRepo);
    TestService testService(wordRepo, recordRepo);
    GameService gameService(wordRepo);

    // 预置管理员账号和示例数据（仅在数据为空时）
    if (userRepo.count() == 0) {
        std::cout << "[Init] Creating default admin account..." << std::endl;
        authService.registerUser("admin", "admin123", "admin@sanctuary.com", "admin", "Administrator");
        authService.registerUser("student", "123456", "student@sanctuary.com", "student", "Student");

        std::cout << "[Init] Creating sample words..." << std::endl;
        wordService.addWord("Ephemeral",
            "\u8f6c\u77ac\u5373\u901d\u7684\uff0c\u77ed\u6682\u7684",
            "The beauty of the sunset was ephemeral, fading into the dark blue of the night within minutes.",
            "1");
        wordService.addWord("Luminous",
            "\u53d1\u5149\u7684\uff0c\u660e\u4eae\u7684",
            "The luminous glow of the fireflies lit up the garden path.",
            "1");
        wordService.addWord("Serendipity",
            "\u673a\u7f18\u5de7\u5408\uff0c\u610f\u5916\u53d1\u73b0\u73cd\u5947\u4e8b\u7269\u7684\u8fd0\u6c14",
            "Finding that rare book at a garage sale was pure serendipity.",
            "1");
        wordService.addWord("Ameliorate",
            "\u6539\u8fdb\uff0c\u6539\u5584",
            "The curator sought to ameliorate the gallery lighting to highlight the textures of the stone sculptures.",
            "1");
        wordService.addWord("Esoteric",
            "\u6df1\u5965\u7684\uff0c\u53ea\u6709\u5185\u884c\u4eba\u624d\u61c2\u7684",
            "The document contained esoteric references that only a seasoned linguist could truly decipher.",
            "1");
        wordService.addWord("Mellifluous",
            "\u60a6\u8033\u7684\uff0c\u6d41\u7545\u7684",
            "The cellist's performance was noted for its mellifluous tones and seamless transitions.",
            "1");
        wordService.addWord("Quixotic",
            "\u5510\u5409\u8bc3\u5fb7\u5f0f\u7684\uff0c\u4e0d\u5207\u5b9e\u9645\u7684",
            "His quixotic quest to eliminate all linguistic ambiguity was met with both admiration and skepticism.",
            "1");
        wordService.addWord("Resilient",
            "\u6709\u5f39\u6027\u7684\uff0c\u80fd\u5feb\u901f\u6062\u590d\u7684",
            "The resilient community rebuilt their neighborhood after the devastating flood.",
            "1");
        wordService.addWord("Tenacious",
            "\u575a\u97e7\u7684\uff0c\u9876\u5f3a\u7684",
            "Her tenacious spirit enabled her to overcome every obstacle in her path.",
            "1");
        wordService.addWord("Ubiquitous",
            "\u65e0\u5904\u4e0d\u5728\u7684",
            "Smartphones have become ubiquitous in modern society.",
            "1");
    }

    // 创建 HTTP 服务器
    httplib::Server svr;

    // CORS 中间件 - 允许跨域请求
    svr.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) -> httplib::Server::HandlerResponse {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type, X-User-Id");

        if (req.method == "OPTIONS") {
            res.status = 204;
            return httplib::Server::HandlerResponse::Handled;
        }
        return httplib::Server::HandlerResponse::Unhandled;
    });

    // ==================== 认证路由 ====================

    /**
     * POST /api/auth/register
     * 用户注册
     */
    svr.Post("/api/auth/register", [&](const httplib::Request& req, httplib::Response& res) {
        auto body = parseBody(req);
        try {
            std::string username = body.value("username", "");
            std::string password = body.value("password", "");
            std::string email = body.value("email", "");
            std::string role = body.value("role", "student");
            std::string name = body.value("name", "");

            if (username.empty() || password.empty()) {
                errorResponse(res, "Username and password are required");
                return;
            }

            auto user = authService.registerUser(username, password, email, role, name);
            jsonResponse(res, {{"user", user.toJson()}, {"message", "Registration successful"}}, 201);
        } catch (const std::exception& e) {
            errorResponse(res, e.what(), 409);
        }
    });

    /**
     * POST /api/auth/login
     * 用户登录
     */
    svr.Post("/api/auth/login", [&](const httplib::Request& req, httplib::Response& res) {
        auto body = parseBody(req);
        try {
            std::string username = body.value("username", "");
            std::string password = body.value("password", "");

            if (username.empty() || password.empty()) {
                errorResponse(res, "Username and password are required");
                return;
            }

            auto user = authService.login(username, password);
            jsonResponse(res, {{"user", user.toJson()}, {"message", "Login successful"}});
        } catch (const std::exception& e) {
            errorResponse(res, e.what(), 401);
        }
    });

    // ==================== 单词路由 ====================

    /**
     * GET /api/words
     * 获取单词列表（支持搜索）
     */
    svr.Get("/api/words", [&](const httplib::Request& req, httplib::Response& res) {
        std::string query = req.get_param_value("q");
        auto words = wordService.searchWords(query);

        json result = json::array();
        for (const auto& w : words) {
            result.push_back(w.toJson());
        }
        jsonResponse(res, {{"words", result}, {"total", words.size()}});
    });

    /**
     * GET /api/words/:id
     * 获取单个单词
     */
    svr.Get(R"(/api/words/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        auto word = wordService.getWordById(id);
        if (word.has_value()) {
            jsonResponse(res, word->toJson());
        } else {
            errorResponse(res, "Word not found", 404);
        }
    });

    /**
     * POST /api/words
     * 添加新单词
     */
    svr.Post("/api/words", [&](const httplib::Request& req, httplib::Response& res) {
        auto body = parseBody(req);
        std::string english = body.value("english", "");
        std::string chinese = body.value("chinese", "");
        std::string example = body.value("example", "");
        std::string userId = req.get_header_value("X-User-Id");
        if (userId.empty()) userId = "1";

        if (english.empty() || chinese.empty()) {
            errorResponse(res, "English and Chinese are required");
            return;
        }

        auto word = wordService.addWord(english, chinese, example, userId);
        jsonResponse(res, {{"word", word.toJson()}, {"message", "Word added successfully"}}, 201);
    });

    /**
     * PUT /api/words/:id
     * 更新单词
     */
    svr.Put(R"(/api/words/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        auto body = parseBody(req);

        bool success = wordService.updateWord(
            id,
            body.value("english", ""),
            body.value("chinese", ""),
            body.value("example", ""),
            body.value("status", "")
        );

        if (success) {
            jsonResponse(res, {{"message", "Word updated successfully"}});
        } else {
            errorResponse(res, "Word not found", 404);
        }
    });

    /**
     * DELETE /api/words/:id
     * 删除单词
     */
    svr.Delete(R"(/api/words/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        if (wordService.deleteWord(id)) {
            jsonResponse(res, {{"message", "Word deleted successfully"}});
        } else {
            errorResponse(res, "Word not found", 404);
        }
    });

    // ==================== 测试路由 ====================

    /**
     * GET /api/test/random
     * 获取随机测试单词
     */
    svr.Get("/api/test/random", [&](const httplib::Request& req, httplib::Response& res) {
        auto word = testService.getRandomWord();
        jsonResponse(res, word);
    });

    /**
     * POST /api/test/submit
     * 提交测试答案
     */
    svr.Post("/api/test/submit", [&](const httplib::Request& req, httplib::Response& res) {
        auto body = parseBody(req);
        std::string userId = req.get_header_value("X-User-Id");
        if (userId.empty()) userId = body.value("userId", "1");

        std::string wordId = body.value("wordId", "");
        std::string answer = body.value("answer", "");

        if (wordId.empty() || answer.empty()) {
            errorResponse(res, "WordId and answer are required");
            return;
        }

        auto result = testService.submitAnswer(userId, wordId, answer);
        jsonResponse(res, result);
    });

    // ==================== 统计路由 ====================

    /**
     * GET /api/stats/:userId
     * 获取用户学习统计
     */
    svr.Get(R"(/api/stats/user/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        std::string userId = req.matches[1];
        auto stats = testService.getUserStats(userId);
        jsonResponse(res, stats);
    });

    /**
     * GET /api/stats/dashboard
     * 获取仪表盘统计数据
     */
    svr.Get("/api/stats/dashboard", [&](const httplib::Request& req, httplib::Response& res) {
        std::string userId = req.get_header_value("X-User-Id");
        if (userId.empty()) userId = req.get_param_value("userId");
        if (userId.empty()) userId = "1";

        bool isAdmin = req.get_param_value("role") == "admin";
        auto stats = testService.getDashboardStats(userId, isAdmin);
        jsonResponse(res, stats);
    });

    // ==================== 用户管理路由 ====================

    /**
     * GET /api/users
     * 获取所有用户（管理员功能）
     */
    svr.Get("/api/users", [&](const httplib::Request& req, httplib::Response& res) {
        auto users = userRepo.findAll();
        json result = json::array();
        for (const auto& u : users) {
            auto userJson = u.toJson();
            // 添加额外的统计信息
            auto stats = testService.getUserStats(u.id);
            userJson["mastered"] = stats.value("masteredCount", 0);
            result.push_back(userJson);
        }
        jsonResponse(res, {{"users", result}, {"total", users.size()}});
    });

    /**
     * PUT /api/users/:id
     * 更新用户信息
     */
    svr.Put(R"(/api/users/(\d+))", [&](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        auto body = parseBody(req);

        auto user = userRepo.findById(id);
        if (!user.has_value()) {
            errorResponse(res, "User not found", 404);
            return;
        }

        if (body.contains("name")) user->name = body["name"].get<std::string>();
        if (body.contains("avatar")) user->avatar = body["avatar"].get<std::string>();
        if (body.contains("email")) user->email = body["email"].get<std::string>();

        userRepo.update(user.value());
        jsonResponse(res, {{"user", user->toJson()}, {"message", "User updated successfully"}});
    });

    /**
     * PUT /api/users/:id/password
     * 修改密码
     */
    svr.Put(R"(/api/users/(\d+)/password)", [&](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        auto body = parseBody(req);

        try {
            std::string oldPassword = body.value("currentPassword", "");
            std::string newPassword = body.value("newPassword", "");

            if (oldPassword.empty() || newPassword.empty()) {
                errorResponse(res, "Current and new passwords are required");
                return;
            }

            authService.changePassword(id, oldPassword, newPassword);
            jsonResponse(res, {{"message", "Password changed successfully"}});
        } catch (const std::exception& e) {
            errorResponse(res, e.what(), 400);
        }
    });

    // ==================== 接龙游戏路由 ====================

    /**
     * POST /api/game/validate
     * 验证接龙单词
     */
    svr.Post("/api/game/validate", [&](const httplib::Request& req, httplib::Response& res) {
        auto body = parseBody(req);
        std::string currentWord = body.value("currentWord", "");
        std::string inputWord = body.value("inputWord", "");

        if (currentWord.empty() || inputWord.empty()) {
            errorResponse(res, "currentWord and inputWord are required");
            return;
        }

        auto result = gameService.validateWord(currentWord, inputWord);
        jsonResponse(res, result);
    });

    // ==================== 健康检查 ====================

    svr.Get("/api/health", [](const httplib::Request&, httplib::Response& res) {
        jsonResponse(res, {{"status", "ok"}, {"service", "Lexical Sanctuary Backend"}});
    });

    // 启动服务器
    const int PORT = 8080;
    std::cout << "================================================" << std::endl;
    std::cout << "  Lexical Sanctuary Backend Server" << std::endl;
    std::cout << "  Listening on http://localhost:" << PORT << std::endl;
    std::cout << "  Default admin: admin / admin123" << std::endl;
    std::cout << "  Default student: student / 123456" << std::endl;
    std::cout << "================================================" << std::endl;

    if (!svr.listen("0.0.0.0", PORT)) {
        std::cerr << "Failed to start server on port " << PORT << std::endl;
        return 1;
    }

    return 0;
}
