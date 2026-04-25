// 单文件 C++17 后端服务（使用 cpp-httplib + nlohmann::json）
// 满足：监听8080端口，CORS允许 http://localhost:3000，数据以CSV文件存储

#include "include/httplib.h"
#include "include/json.hpp"

#include <filesystem>
#include <fstream>
#include <sstream>
#include <random>
#include <algorithm>
#include <chrono>
#include <unordered_set>

using json = nlohmann::json;
using namespace httplib;
namespace fs = std::filesystem;

static const std::string DATA_DIR = "data";
static const std::string USERS_CSV = DATA_DIR + "/users.csv";
static const std::string WORDS_CSV = DATA_DIR + "/words.csv";
static const std::string RECORDS_CSV = DATA_DIR + "/records.csv";
static const std::string GAME_RECORDS_CSV = DATA_DIR + "/game_records.csv";
static std::mutex file_mutex;

// Utility: ensure data directory and files exist
void ensure_data_files() {
    std::error_code ec;
    fs::create_directories(DATA_DIR, ec);
    auto ensure = [&](const std::string &p) {
        if (!fs::exists(p)) {
            std::ofstream ofs(p, std::ios::app);
        }
    };
    ensure(USERS_CSV);
    ensure(WORDS_CSV);
    ensure(RECORDS_CSV);
    ensure(GAME_RECORDS_CSV);
}

// CSV helper: parse line into fields (handles quoted fields)
std::vector<std::string> parse_csv_line(const std::string &line) {
    std::vector<std::string> out;
    std::string cur;
    bool in_quotes = false;
    for (size_t i = 0; i < line.size(); ++i) {
        char c = line[i];
        if (c == '"') {
            if (in_quotes && i + 1 < line.size() && line[i+1] == '"') {
                cur.push_back('"');
                ++i;
            } else {
                in_quotes = !in_quotes;
            }
        } else if (c == ',' && !in_quotes) {
            out.push_back(cur);
            cur.clear();
        } else {
            cur.push_back(c);
        }
    }
    out.push_back(cur);
    return out;
}

std::string escape_csv_field(const std::string &s) {
    bool need = s.find(',') != std::string::npos || s.find('"') != std::string::npos || s.find('\n') != std::string::npos;
    if (!need) return s;
    std::string out = "\"";
    for (char c : s) {
        if (c == '"') out += "\"\"";
        else out.push_back(c);
    }
    out += "\"";
    return out;
}

// Read all CSV lines
std::vector<std::string> read_all_lines(const std::string &path) {
    std::lock_guard<std::mutex> lk(file_mutex);
    std::vector<std::string> lines;
    std::ifstream ifs(path);
    if (!ifs) return lines;
    std::string line;
    while (std::getline(ifs, line)) {
        if (!line.empty()) lines.push_back(line);
    }
    return lines;
}

// Overwrite file with provided lines
bool write_all_lines(const std::string &path, const std::vector<std::string> &lines) {
    std::lock_guard<std::mutex> lk(file_mutex);
    std::ofstream ofs(path, std::ios::trunc);
    if (!ofs) return false;
    for (size_t i = 0; i < lines.size(); ++i) {
        ofs << lines[i];
        if (i + 1 < lines.size()) ofs << '\n';
    }
    return true;
}

bool append_line(const std::string &path, const std::string &line) {
    std::lock_guard<std::mutex> lk(file_mutex);
    std::ofstream ofs(path, std::ios::app);
    if (!ofs) return false;
    ofs << line << '\n';
    return true;
}

// User helpers
struct User {
    std::string username, password, role;
    int total_tests = 0;
    int correct = 0;
    double accuracy = 0.0;
    int streak = 0;
};

std::optional<User> find_user(const std::string &username) {
    auto lines = read_all_lines(USERS_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 7) continue;
        if (f[0] == username) {
            User u;
            u.username = f[0]; u.password = f[1]; u.role = f[2];
            try { u.total_tests = std::stoi(f[3]); } catch(...) { u.total_tests = 0; }
            try { u.correct = std::stoi(f[4]); } catch(...) { u.correct = 0; }
            try { u.accuracy = std::stod(f[5]); } catch(...) { u.accuracy = 0.0; }
            try { u.streak = std::stoi(f[6]); } catch(...) { u.streak = 0; }
            return u;
        }
    }
    return std::nullopt;
}

bool upsert_user(const User &u) {
    auto lines = read_all_lines(USERS_CSV);
    bool found = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 1 && f[0] == u.username) {
            std::vector<std::string> fields = {u.username, u.password, u.role, std::to_string(u.total_tests), std::to_string(u.correct), std::to_string(u.accuracy), std::to_string(u.streak)};
            ln.clear();
            for (size_t i = 0; i < fields.size(); ++i) {
                ln += escape_csv_field(fields[i]);
                if (i + 1 < fields.size()) ln.push_back(',');
            }
            found = true;
            break;
        }
    }
    if (!found) {
        std::vector<std::string> fields = {u.username, u.password, u.role, std::to_string(u.total_tests), std::to_string(u.correct), std::to_string(u.accuracy), std::to_string(u.streak)};
        std::string line;
        for (size_t i = 0; i < fields.size(); ++i) {
            line += escape_csv_field(fields[i]);
            if (i + 1 < fields.size()) line.push_back(',');
        }
        lines.push_back(line);
    }
    return write_all_lines(USERS_CSV, lines);
}

// Remove user and optionally related data
bool delete_user(const std::string &username) {
    auto lines = read_all_lines(USERS_CSV);
    std::vector<std::string> out;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 1 && f[0] == username) continue;
        out.push_back(ln);
    }
    bool ok = write_all_lines(USERS_CSV, out);
    // remove user records and words created by user
    auto recs = read_all_lines(RECORDS_CSV);
    std::vector<std::string> recs_out;
    for (auto &ln : recs) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 1 && f[0] == username) continue;
        recs_out.push_back(ln);
    }
    write_all_lines(RECORDS_CSV, recs_out);

    auto words = read_all_lines(WORDS_CSV);
    std::vector<std::string> words_out;
    for (auto &ln : words) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 6 && f[5] == username) continue;
        words_out.push_back(ln);
    }
    write_all_lines(WORDS_CSV, words_out);
    return ok;
}

// Word struct fields per spec:
// 英文单词,中文释义,例句,词性,语源,创建者用户名,掌握状态(已掌握/进行中)

struct Word {
    std::string word, meaning, example, pos, origin, creator, status;
};

std::vector<Word> read_words(bool admin_view=false, const std::string &username="") {
    std::vector<Word> out;
    auto lines = read_all_lines(WORDS_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 7) continue;
        if (!admin_view && f[5] != username) continue;
        Word w{f[0], f[1], f[2], f[3], f[4], f[5], f[6]};
        out.push_back(w);
    }
    return out;
}

bool add_word(const Word &w) {
    // de-duplicate by exact English + creator
    auto lines = read_all_lines(WORDS_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 2 && f[0] == w.word && f[5] == w.creator) return false;
    }
    std::vector<std::string> fields = {w.word, w.meaning, w.example, w.pos, w.origin, w.creator, w.status};
    std::string line;
    for (size_t i = 0; i < fields.size(); ++i) {
        line += escape_csv_field(fields[i]);
        if (i + 1 < fields.size()) line.push_back(',');
    }
    return append_line(WORDS_CSV, line);
}

// Append a test record and update user stats
bool record_test(const std::string &username, const std::string &test_word, int result, double time_used, int skipped) {
    std::vector<std::string> fields = {username, test_word, std::to_string(result), std::to_string(time_used), std::to_string(skipped), std::to_string((long long)std::chrono::system_clock::to_time_t(std::chrono::system_clock::now()))};
    std::string line;
    for (size_t i = 0; i < fields.size(); ++i) {
        line += escape_csv_field(fields[i]);
        if (i + 1 < fields.size()) line.push_back(',');
    }
    if (!append_line(RECORDS_CSV, line)) return false;
    auto uopt = find_user(username);
    if (!uopt) return true;
    User u = *uopt;
    u.total_tests += 1;
    if (result == 1) u.correct += 1;
    u.accuracy = (u.total_tests > 0) ? (double)u.correct / u.total_tests : 0.0;
    // update streak: naive increment on correct, reset on incorrect
    if (result == 1) u.streak += 1; else u.streak = 0;
    return upsert_user(u);
}

// Save game record
bool save_game_record(const std::string &username, const std::string &game_time, int total_score, int chain_len, const std::string &used_words, double duration) {
    std::vector<std::string> fields = {username, game_time, std::to_string(total_score), std::to_string(chain_len), used_words, std::to_string(duration)};
    std::string line;
    for (size_t i = 0; i < fields.size(); ++i) {
        line += escape_csv_field(fields[i]);
        if (i + 1 < fields.size()) line.push_back(',');
    }
    return append_line(GAME_RECORDS_CSV, line);
}

// Random words from user's pool
std::vector<Word> random_words_for_user(const std::string &username, int count) {
    auto pool = read_words(false, username);
    // 过滤已掌握的单词，避免在测验中再次出现
    std::vector<Word> filtered;
    for (auto &w : pool) {
        if (w.status == "mastered" || w.status == "已掌握") continue;
        filtered.push_back(w);
    }
    pool = filtered;
    std::random_device rd;
    std::mt19937 g(rd());
    std::shuffle(pool.begin(), pool.end(), g);
    if ((int)pool.size() > count) pool.resize(count);
    return pool;
}

// Helper for JSON response
std::string make_resp(int code, const std::string &msg, const json &data = {}) {
    json r;
    r["code"] = code;
    r["msg"] = msg;
    r["data"] = data;
    return r.dump();
}

int main() {
    ensure_data_files();

    Server svr;

    // Pre-routing handler to add CORS and handle OPTIONS
    svr.set_pre_routing_handler([&](const Request &req, Response &res) {
        res.set_header("Access-Control-Allow-Origin", "http://localhost:3000");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.set_header("Access-Control-Allow-Credentials", "true");
        if (req.method == "OPTIONS") {
            res.status = 200;
            res.set_content("", "text/plain");
            return httplib::Server::HandlerResponse::Handled; // handled
        }
        return httplib::Server::HandlerResponse::Unhandled; // continue
    });

    // Health
    svr.Get(R"(/api/ping)", [&](const Request &req, Response &res){
        res.set_content(make_resp(200, "pong", { {"time", (long long)std::chrono::system_clock::to_time_t(std::chrono::system_clock::now())} }), "application/json");
    });

    // Register
    svr.Post(R"(/api/register)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string username = j.value("username", "");
            std::string password = j.value("password", "");
            std::string role = j.value("role", "user");
            if (username.empty() || password.empty()) {
                res.set_content(make_resp(500, "用户名或密码为空"), "application/json"); return;
            }
            if (find_user(username)) { res.set_content(make_resp(500, "用户名已存在"), "application/json"); return; }
            User u; u.username = username; u.password = password; u.role = role; u.total_tests=0; u.correct=0; u.accuracy=0.0; u.streak=0;
            if (!upsert_user(u)) { res.set_content(make_resp(500, "写入用户失败"), "application/json"); return; }
            res.set_content(make_resp(200, "注册成功", { {"username", username}, {"role", role} }), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // Login
    svr.Post(R"(/api/login)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string username = j.value("username", "");
            std::string password = j.value("password", "");
            if (username.empty() || password.empty()) { res.set_content(make_resp(500, "用户名或密码为空"), "application/json"); return; }
            auto uopt = find_user(username);
            if (!uopt) { res.set_content(make_resp(500, "用户不存在"), "application/json"); return; }
            User u = *uopt;
            if (u.password != password) { res.set_content(make_resp(500, "密码错误"), "application/json"); return; }
            json data = { {"username", u.username}, {"role", u.role}, {"total_tests", u.total_tests}, {"correct", u.correct}, {"accuracy", u.accuracy}, {"streak", u.streak} };
            res.set_content(make_resp(200, "登录成功", data), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // Change password
    svr.Post(R"(/api/change_password)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string username = j.value("username", "");
            std::string oldp = j.value("old_password", "");
            std::string newp = j.value("new_password", "");
            if (username.empty() || oldp.empty() || newp.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            auto uopt = find_user(username);
            if (!uopt) { res.set_content(make_resp(500, "用户不存在"), "application/json"); return; }
            User u = *uopt;
            if (u.password != oldp) { res.set_content(make_resp(500, "旧密码错误"), "application/json"); return; }
            u.password = newp;
            if (!upsert_user(u)) { res.set_content(make_resp(500, "保存失败"), "application/json"); return; }
            res.set_content(make_resp(200, "修改成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // Admin: list users
    svr.Get(R"(/api/admin/users)", [&](const Request &req, Response &res){
        std::string role = req.get_param_value("role");
        if (role != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
        auto lines = read_all_lines(USERS_CSV);
        json arr = json::array();
        for (auto &ln: lines) {
            auto f = parse_csv_line(ln);
            if (f.size() < 7) continue;
            arr.push_back({{"username", f[0]}, {"role", f[2]}, {"total_tests", std::stoi(f[3])}, {"correct", std::stoi(f[4])}, {"accuracy", std::stod(f[5])}, {"streak", std::stoi(f[6])}});
        }
        res.set_content(make_resp(200, "ok", arr), "application/json");
    });

    // Admin: delete user
    svr.Post(R"(/api/admin/delete_user)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role","") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            std::string target = j.value("username","");
            if (target.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!delete_user(target)) { res.set_content(make_resp(500, "删除失败"), "application/json"); return; }
            res.set_content(make_resp(200, "删除成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // Add single word
    svr.Post(R"(/api/word/add)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            Word w;
            w.word = j.value("word", "");
            w.meaning = j.value("meaning", "");
            w.example = j.value("example", "");
            w.pos = j.value("pos", "");
            w.origin = j.value("origin", "");
            w.creator = j.value("creator", "");
            w.status = j.value("status", "进行中");
            if (w.word.empty() || w.creator.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!add_word(w)) { res.set_content(make_resp(500, "单词已存在"), "application/json"); return; }
            res.set_content(make_resp(200, "添加成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // Import words via raw CSV content in body (支持 text/plain 或 JSON {content: '...'} )
    svr.Post(R"(/api/word/import)", [&](const Request &req, Response &res){
        try {
            std::string content = req.body;
            if (content.rfind("{",0) == 0) {
                auto j = json::parse(req.body);
                content = j.value("content", "");
            }
            if (content.empty()) { res.set_content(make_resp(500, "空内容"), "application/json"); return; }
            std::istringstream iss(content);
            std::string line;
            int count = 0;
            int added = 0;
            while (std::getline(iss, line)) {
                if (line.empty()) continue;
                ++count;
                if (count > 500) break;
                auto f = parse_csv_line(line);
                // expect 7 fields
                if (f.size() < 7) continue;
                Word w{f[0], f[1], f[2], f[3], f[4], f[5], f[6]};
                if (add_word(w)) ++added;
            }
            res.set_content(make_resp(200, "导入完成", { {"attempted", count}, {"added", added} }), "application/json");
        } catch (...) { res.set_content(make_resp(500, "导入失败"), "application/json"); }
    });

    // Delete word: POST /api/word/delete { id }
    svr.Post(R"(/api/word/delete)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string id = j.value("id", "");
            if (id.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            auto lines = read_all_lines(WORDS_CSV);
            std::vector<std::string> out;
            bool found = false;
            for (auto &ln : lines) {
                auto f = parse_csv_line(ln);
                if (f.size() >= 1 && f[0] == id) {
                    found = true;
                    continue;
                }
                out.push_back(ln);
            }
            if (!found) { res.set_content(make_resp(500, "单词不存在"), "application/json"); return; }
            write_all_lines(WORDS_CSV, out);
            res.set_content(make_resp(200, "删除成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // Update word: POST /api/word/update {original,word,meaning,example,pos,origin,creator,status}
    svr.Post(R"(/api/word/update)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string original = j.value("original", "");
            std::string word = j.value("word", "");
            std::string meaning = j.value("meaning", "");
            std::string example = j.value("example", "");
            std::string pos = j.value("pos", "");
            std::string origin = j.value("origin", "");
            std::string creator = j.value("creator", "");
            std::string status = j.value("status", "进行中");
            if (original.empty() || creator.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            auto lines = read_all_lines(WORDS_CSV);
            bool found = false;
            for (auto &ln : lines) {
                auto f = parse_csv_line(ln);
                if (f.size() >= 7 && f[0] == original && f[5] == creator) {
                    std::vector<std::string> fields = {word, meaning, example, pos, origin, creator, status};
                    ln.clear();
                    for (size_t i = 0; i < fields.size(); ++i) {
                        ln += escape_csv_field(fields[i]);
                        if (i + 1 < fields.size()) ln.push_back(',');
                    }
                    found = true;
                    break;
                }
            }
            if (!found) { res.set_content(make_resp(500, "单词未找到"), "application/json"); return; }
            if (!write_all_lines(WORDS_CSV, lines)) { res.set_content(make_resp(500, "写入失败"), "application/json"); return; }
            res.set_content(make_resp(200, "更新成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // List words: GET /api/word/list?username=xxx&admin=1
    svr.Get(R"(/api/word/list)", [&](const Request &req, Response &res){
        std::string username = req.get_param_value("username");
        std::string admin = req.get_param_value("admin");
        bool is_admin = (admin == "1" || admin == "true" || admin == "admin");
        auto ws = read_words(is_admin, username);
        json arr = json::array();
        for (auto &w : ws) arr.push_back({{"word", w.word}, {"meaning", w.meaning}, {"example", w.example}, {"pos", w.pos}, {"origin", w.origin}, {"creator", w.creator}, {"status", w.status}});
        res.set_content(make_resp(200, "ok", arr), "application/json");
    });

    // Random test: POST /api/test/random {username,count}
    svr.Post(R"(/api/test/random)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string username = j.value("username", "");
            int count = j.value("count", 10);
            if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            auto words = random_words_for_user(username, count);
            json arr = json::array();
            for (auto &w : words) arr.push_back({{"word", w.word}, {"meaning", w.meaning}, {"example", w.example}, {"pos", w.pos}});
            res.set_content(make_resp(200, "ok", arr), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // Submit test result: POST /api/test/submit {username,word,result(1/0),time,skipped}
    svr.Post(R"(/api/test/submit)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string username = j.value("username", "");
            std::string word = j.value("word", "");
            int result = j.value("result", 0);
            double t = j.value("time", 0.0);
            int skipped = j.value("skipped", 0);
            if (username.empty() || word.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!record_test(username, word, result, t, skipped)) { res.set_content(make_resp(500, "记录失败"), "application/json"); return; }
            res.set_content(make_resp(200, "记录成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // Get test records for user
    svr.Get(R"(/api/records)", [&](const Request &req, Response &res){
        std::string username = req.get_param_value("username");
        auto lines = read_all_lines(RECORDS_CSV);
        json arr = json::array();
        for (auto &ln: lines) {
            auto f = parse_csv_line(ln);
            if (f.size() < 6) continue;
            if (!username.empty() && f[0] != username) continue;
            arr.push_back({{"username", f[0]}, {"word", f[1]}, {"result", std::stoi(f[2])}, {"time", std::stod(f[3])}, {"skipped", std::stoi(f[4])}, {"ts", f[5]}});
        }
        res.set_content(make_resp(200, "ok", arr), "application/json");
    });

    // Game start: returns time and initial info (server side not maintaining sessions)
    svr.Post(R"(/api/game/start)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string username = j.value("username", "");
            int time_limit = j.value("time_limit", 60);
            if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            // provide a pool of words
            auto pool = random_words_for_user(username, 100);
            json arr = json::array();
            for (auto &w : pool) arr.push_back({{"word", w.word}});
            res.set_content(make_resp(200, "ok", { {"time_limit", time_limit}, {"pool_size", (int)pool.size()}, {"pool", arr} }), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // Save game result
    svr.Post(R"(/api/game/submit)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string username = j.value("username", "");
            int total_score = j.value("total_score", 0);
            int chain_len = j.value("chain_len", 0);
            double duration = j.value("duration", 0.0);
            std::string used_words = j.value("used_words", "");
            auto now = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
            if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!save_game_record(username, std::to_string((long long)now), total_score, chain_len, used_words, duration)) { res.set_content(make_resp(500, "保存失败"), "application/json"); return; }
            res.set_content(make_resp(200, "保存成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // Stats: aggregate for user
    svr.Get(R"(/api/stats)", [&](const Request &req, Response &res){
        std::string username = req.get_param_value("username");
        if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
        auto uopt = find_user(username);
        if (!uopt) { res.set_content(make_resp(500, "用户不存在"), "application/json"); return; }
        User u = *uopt;
        auto lines = read_all_lines(RECORDS_CSV);
        int errors = 0;
        double avg_time = 0.0;
        int cnt = 0;
        std::unordered_set<std::string> masteredWords;
        for (auto &ln : lines) {
            auto f = parse_csv_line(ln);
            if (f.size() < 6) continue;
            if (f[0] != username) continue;
            ++cnt; avg_time += std::stod(f[3]); if (std::stoi(f[2])==0) ++errors;
            if (std::stoi(f[2]) == 1) masteredWords.insert(f[1]);
        }
        if (cnt>0) avg_time /= cnt;
        json data = { {"total_tests", u.total_tests}, {"correct", u.correct}, {"errors", errors}, {"accuracy", u.accuracy}, {"avg_time", avg_time}, {"streak", u.streak}, {"masteredCount", masteredWords.size()} };
        res.set_content(make_resp(200, "ok", data), "application/json");
    });

    printf("Starting server on http://0.0.0.0:8080\n");
    svr.listen("0.0.0.0", 8080);
    return 0;
}
