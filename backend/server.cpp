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
#include <ctime>
#include <unordered_map>

using json = nlohmann::json;
using namespace httplib;
namespace fs = std::filesystem;

static const std::string DATA_DIR = "data";
static const std::string USERS_CSV = DATA_DIR + "/users.csv";
static const std::string WORDS_CSV = DATA_DIR + "/words.csv";
static const std::string RECORDS_CSV = DATA_DIR + "/records.csv";
static const std::string GAME_RECORDS_CSV = DATA_DIR + "/game_records.csv";
static const std::string DICT_CSV = DATA_DIR + "/dictionary.csv";
static const std::string CONFIG_FILE = DATA_DIR + "/system_config.json";
static const std::string CONTRIB_CSV = DATA_DIR + "/contributions.csv";
static const std::string POSTS_CSV = DATA_DIR + "/posts.csv";
static const std::string COMMENTS_CSV = DATA_DIR + "/comments.csv";
static const std::string LIKES_CSV = DATA_DIR + "/likes.csv";
static const std::string FRIENDS_CSV = DATA_DIR + "/friends.csv";
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
    ensure(DICT_CSV);
    ensure(CONTRIB_CSV);
    ensure(POSTS_CSV);
    ensure(COMMENTS_CSV);
    ensure(LIKES_CSV);
    ensure(FRIENDS_CSV);
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
    bool disabled = false;
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
            u.disabled = f.size() > 7 && f[7] == "1";
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
            std::vector<std::string> fields = {u.username, u.password, u.role, std::to_string(u.total_tests), std::to_string(u.correct), std::to_string(u.accuracy), std::to_string(u.streak), u.disabled ? "1" : "0"};
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
        std::vector<std::string> fields = {u.username, u.password, u.role, std::to_string(u.total_tests), std::to_string(u.correct), std::to_string(u.accuracy), std::to_string(u.streak), u.disabled ? "1" : "0"};
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

// Dictionary entry: word,meaning,source,example,frequency
struct DictEntry {
    std::string word, meaning, source, example, frequency;
};

std::vector<DictEntry> read_dictionary(const std::string &source_filter = "") {
    std::vector<DictEntry> out;
    auto lines = read_all_lines(DICT_CSV);
    bool first = true;
    for (auto &ln : lines) {
        if (first) { first = false; continue; } // skip header
        auto f = parse_csv_line(ln);
        if (f.size() < 5) continue;
        if (!source_filter.empty() && f[2] != source_filter) continue;
        out.push_back({f[0], f[1], f[2], f[3], f[4]});
    }
    return out;
}

std::vector<DictEntry> search_dictionary(const std::string &q, const std::string &source = "") {
    auto all = read_dictionary(source);
    if (q.empty()) return all;
    std::vector<DictEntry> out;
    std::string lower_q;
    for (char c : q) lower_q += std::tolower(c);
    for (auto &d : all) {
        std::string lower_word;
        for (char c : d.word) lower_word += std::tolower(c);
        if (lower_word.find(lower_q) != std::string::npos ||
            d.meaning.find(q) != std::string::npos) {
            out.push_back(d);
        }
    }
    return out;
}

// Word struct fields per spec:
// 英文单词,中文释义,例句,词性,语源,创建者用户名,掌握状态(已掌握/进行中)

struct Word {
    std::string word, meaning, example, pos, origin, creator, status, created_at;
};

std::vector<Word> read_words(bool admin_view=false, const std::string &username="") {
    std::vector<Word> out;
    auto lines = read_all_lines(WORDS_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 7) continue;
        if (!admin_view && f[5] != username) continue;
        Word w{f[0], f[1], f[2], f[3], f[4], f[5], f[6], f.size() > 7 ? f[7] : ""};
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
    std::string ts = w.created_at.empty() ? std::to_string((long long)std::chrono::system_clock::to_time_t(std::chrono::system_clock::now())) : w.created_at;
    std::vector<std::string> fields = {w.word, w.meaning, w.example, w.pos, w.origin, w.creator, w.status, ts};
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

// ========== Admin helper functions ==========

json load_config() {
    std::lock_guard<std::mutex> lk(file_mutex);
    std::ifstream ifs(CONFIG_FILE);
    if (!ifs) return {{"announcement", ""}, {"maintenance_mode", false}, {"maintenance_message", ""}};
    try { json j; ifs >> j; return j; } catch (...) { return {{"announcement", ""}, {"maintenance_mode", false}, {"maintenance_message", ""}}; }
}

bool save_config(const json &j) {
    std::lock_guard<std::mutex> lk(file_mutex);
    std::ofstream ofs(CONFIG_FILE);
    if (!ofs) return false;
    ofs << j.dump(2);
    return true;
}

bool add_dict_entry(const DictEntry &e) {
    auto lines = read_all_lines(DICT_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 2 && f[0] == e.word && f[2] == e.source) return false;
    }
    std::string line = escape_csv_field(e.word) + "," + escape_csv_field(e.meaning) + "," + escape_csv_field(e.source) + "," + escape_csv_field(e.example) + "," + escape_csv_field(e.frequency);
    return append_line(DICT_CSV, line);
}

bool update_dict_entry(const std::string &original_word, const std::string &original_source, const DictEntry &e) {
    auto lines = read_all_lines(DICT_CSV);
    bool found = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 5 && f[0] == original_word && f[2] == original_source) {
            ln = escape_csv_field(e.word) + "," + escape_csv_field(e.meaning) + "," + escape_csv_field(e.source) + "," + escape_csv_field(e.example) + "," + escape_csv_field(e.frequency);
            found = true;
            break;
        }
    }
    if (!found) return false;
    return write_all_lines(DICT_CSV, lines);
}

bool delete_dict_entry(const std::string &word, const std::string &source) {
    auto lines = read_all_lines(DICT_CSV);
    std::vector<std::string> out;
    bool found = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 5 && f[0] == word && f[2] == source) { found = true; continue; }
        out.push_back(ln);
    }
    if (!found) return false;
    return write_all_lines(DICT_CSV, out);
}

std::vector<Word> list_words_by_status(const std::string &status_filter) {
    std::vector<Word> out;
    auto lines = read_all_lines(WORDS_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 7) continue;
        if (status_filter.empty() || f[6] == status_filter) {
            out.push_back({f[0], f[1], f[2], f[3], f[4], f[5], f[6], f.size() > 7 ? f[7] : ""});
        }
    }
    return out;
}

bool set_word_status(const std::string &word, const std::string &creator, const std::string &new_status) {
    auto lines = read_all_lines(WORDS_CSV);
    bool found = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 7 && f[0] == word && f[5] == creator) {
            std::string created_at = f.size() > 7 ? f[7] : "";
            std::vector<std::string> fields = {f[0], f[1], f[2], f[3], f[4], f[5], new_status, created_at};
            ln.clear();
            for (size_t i = 0; i < fields.size(); ++i) {
                ln += escape_csv_field(fields[i]);
                if (i + 1 < fields.size()) ln.push_back(',');
            }
            found = true;
            break;
        }
    }
    if (!found) return false;
    return write_all_lines(WORDS_CSV, lines);
}

struct Contribution {
    std::string word, meaning, example, pos, creator, status, created_at;
};

bool add_contribution(const Contribution &c) {
    auto lines = read_all_lines(CONTRIB_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 2 && f[0] == c.word && f[5] == c.creator) return false;
    }
    std::string ts = c.created_at.empty() ? std::to_string((long long)std::chrono::system_clock::to_time_t(std::chrono::system_clock::now())) : c.created_at;
    std::vector<std::string> fields = {c.word, c.meaning, c.example, c.pos, c.creator, c.status, ts};
    std::string line;
    for (size_t i = 0; i < fields.size(); ++i) {
        line += escape_csv_field(fields[i]);
        if (i + 1 < fields.size()) line.push_back(',');
    }
    return append_line(CONTRIB_CSV, line);
}

std::vector<Contribution> list_contributions(const std::string &status_filter) {
    std::vector<Contribution> out;
    auto lines = read_all_lines(CONTRIB_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 6) continue;
        Contribution c;
        c.word = f[0];
        c.meaning = f.size() > 1 ? f[1] : "";
        c.example = f.size() > 2 ? f[2] : "";
        c.pos = f.size() > 3 ? f[3] : "";
        c.creator = f.size() > 4 ? f[4] : "";
        c.status = f.size() > 5 ? f[5] : "";
        c.created_at = f.size() > 6 ? f[6] : "";
        if (status_filter.empty() || c.status == status_filter) {
            out.push_back(c);
        }
    }
    return out;
}

bool set_contribution_status(const std::string &word, const std::string &creator, const std::string &new_status) {
    auto lines = read_all_lines(CONTRIB_CSV);
    bool found = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 6 && f[0] == word && f[4] == creator) {
            std::string created_at = f.size() > 6 ? f[6] : "";
            std::vector<std::string> fields = {f[0], f[1], f[2], f[3], f[4], new_status, created_at};
            ln.clear();
            for (size_t i = 0; i < fields.size(); ++i) {
                ln += escape_csv_field(fields[i]);
                if (i + 1 < fields.size()) ln.push_back(',');
            }
            found = true;
            break;
        }
    }
    if (!found) return false;
    return write_all_lines(CONTRIB_CSV, lines);
}

bool set_user_disabled(const std::string &username, bool disabled) {
    auto uopt = find_user(username);
    if (!uopt) return false;
    User u = *uopt;
    u.disabled = disabled;
    return upsert_user(u);
}

bool admin_reset_password(const std::string &username, const std::string &new_password) {
    auto uopt = find_user(username);
    if (!uopt) return false;
    User u = *uopt;
    u.password = new_password;
    return upsert_user(u);
}

bool delete_game_record(const std::string &username, const std::string &game_time) {
    auto lines = read_all_lines(GAME_RECORDS_CSV);
    std::vector<std::string> out;
    bool found = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 2 && f[0] == username && f[1] == game_time) { found = true; continue; }
        out.push_back(ln);
    }
    if (!found) return false;
    return write_all_lines(GAME_RECORDS_CSV, out);
}

json get_admin_dashboard_stats() {
    auto user_lines = read_all_lines(USERS_CSV);
    int total_users = (int)user_lines.size();

    auto word_lines = read_all_lines(WORDS_CSV);
    int total_words = (int)word_lines.size();

    auto rec_lines = read_all_lines(RECORDS_CSV);

    auto now = std::chrono::system_clock::now();
    auto now_time = std::chrono::system_clock::to_time_t(now);
    auto tm = *std::localtime(&now_time);
    char today_buf[16];
    std::strftime(today_buf, sizeof(today_buf), "%Y%m%d", &tm);
    std::string today_prefix(today_buf);

    int today_tests = 0;
    int today_new_words = 0;
    std::unordered_map<std::string, int> user_test_count;
    auto week_ago = now - std::chrono::hours(24 * 7);
    auto week_ago_time = std::chrono::system_clock::to_time_t(week_ago);
    long long week_ago_ts = (long long)week_ago_time;

    for (auto &ln : rec_lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 6) continue;
        if (f[0].empty()) continue;
        std::string ts = f[5];
        if (ts.empty()) continue;
        long long ts_val = std::stoll(ts);
        if (ts_val >= week_ago_ts) user_test_count[f[0]]++;
        auto ts_time = (std::time_t)ts_val;
        auto ts_tm = *std::localtime(&ts_time);
        char ts_buf[16];
        std::strftime(ts_buf, sizeof(ts_buf), "%Y%m%d", &ts_tm);
        if (today_prefix == ts_buf) today_tests++;
    }

    // Count today's new words by checking created_at timestamps
    for (auto &ln : word_lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 8) continue;
        std::string ts = f[7];
        if (ts.empty()) continue;
        long long ts_val = std::stoll(ts);
        auto ts_time = (std::time_t)ts_val;
        auto ts_tm = *std::localtime(&ts_time);
        char ts_buf[16];
        std::strftime(ts_buf, sizeof(ts_buf), "%Y%m%d", &ts_tm);
        if (today_prefix == ts_buf) today_new_words++;
    }

    json active_arr = json::array();
    std::vector<std::pair<std::string, int>> sorted_uv(user_test_count.begin(), user_test_count.end());
    std::sort(sorted_uv.begin(), sorted_uv.end(), [](auto &a, auto &b) { return a.second > b.second; });
    int rank = 0;
    for (auto &[uname, cnt] : sorted_uv) {
        if (++rank > 10) break;
        active_arr.push_back({{"username", uname}, {"test_count", cnt}});
    }

    return {{"total_users", total_users}, {"total_words", total_words}, {"today_new_words", today_new_words}, {"today_tests", today_tests}, {"active_users", active_arr}};
}

// ============ Community helpers ============
struct Post {
    std::string id, author, content, type, word, meaning, example, created_at;
    int likes_count = 0, comments_count = 0;
};

struct Comment {
    std::string id, post_id, author, content, created_at;
};

struct FriendRel {
    std::string user1, user2, status, created_at;
};

std::string gen_id() {
    auto now = std::chrono::system_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
    return std::to_string(ms);
}

std::vector<Post> read_posts(const std::string &type_filter = "") {
    std::vector<Post> posts;
    auto lines = read_all_lines(POSTS_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 10) continue;
        Post p;
        p.id = f[0]; p.author = f[1]; p.content = f[2]; p.type = f[3];
        p.word = f[4]; p.meaning = f[5]; p.example = f[6]; p.created_at = f[7];
        p.likes_count = std::stoi(f[8]); p.comments_count = std::stoi(f[9]);
        if (type_filter.empty() || p.type == type_filter) posts.push_back(p);
    }
    std::reverse(posts.begin(), posts.end());
    return posts;
}

bool append_post(const Post &p) {
    std::vector<std::string> fields = {p.id, p.author, p.content, p.type, p.word, p.meaning, p.example, p.created_at, std::to_string(p.likes_count), std::to_string(p.comments_count)};
    std::string ln;
    for (size_t i = 0; i < fields.size(); ++i) {
        ln += escape_csv_field(fields[i]);
        if (i + 1 < fields.size()) ln.push_back(',');
    }
    return append_line(POSTS_CSV, ln);
}

bool delete_post_by_id(const std::string &post_id) {
    auto lines = read_all_lines(POSTS_CSV);
    std::vector<std::string> out;
    bool found = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 1 && f[0] == post_id) { found = true; continue; }
        out.push_back(ln);
    }
    if (!found) return false;
    return write_all_lines(POSTS_CSV, out);
}

bool update_post_counters(const std::string &post_id, int likes_delta, int comments_delta) {
    auto lines = read_all_lines(POSTS_CSV);
    bool found = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 10 && f[0] == post_id) {
            f[8] = std::to_string(std::stoi(f[8]) + likes_delta);
            f[9] = std::to_string(std::stoi(f[9]) + comments_delta);
            ln.clear();
            for (size_t i = 0; i < f.size(); ++i) {
                ln += escape_csv_field(f[i]);
                if (i + 1 < f.size()) ln.push_back(',');
            }
            found = true;
            break;
        }
    }
    if (!found) return false;
    return write_all_lines(POSTS_CSV, lines);
}

std::vector<Comment> read_comments(const std::string &post_id = "") {
    std::vector<Comment> comments;
    auto lines = read_all_lines(COMMENTS_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 5) continue;
        Comment c;
        c.id = f[0]; c.post_id = f[1]; c.author = f[2]; c.content = f[3]; c.created_at = f[4];
        if (post_id.empty() || c.post_id == post_id) comments.push_back(c);
    }
    return comments;
}

bool append_comment(const Comment &c) {
    std::vector<std::string> fields = {c.id, c.post_id, c.author, c.content, c.created_at};
    std::string ln;
    for (size_t i = 0; i < fields.size(); ++i) {
        ln += escape_csv_field(fields[i]);
        if (i + 1 < fields.size()) ln.push_back(',');
    }
    return append_line(COMMENTS_CSV, ln);
}

bool delete_comment_by_id(const std::string &comment_id) {
    auto lines = read_all_lines(COMMENTS_CSV);
    std::vector<std::string> out;
    bool found = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 1 && f[0] == comment_id) { found = true; continue; }
        out.push_back(ln);
    }
    if (!found) return false;
    return write_all_lines(COMMENTS_CSV, out);
}

void delete_comments_by_post_id(const std::string &post_id) {
    auto lines = read_all_lines(COMMENTS_CSV);
    std::vector<std::string> out;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 2 && f[1] == post_id) continue;
        out.push_back(ln);
    }
    write_all_lines(COMMENTS_CSV, out);
}

// Likes/Favorites: type = "like" or "favorite"
bool has_user_action(const std::string &username, const std::string &post_id, const std::string &action_type) {
    auto lines = read_all_lines(LIKES_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 3 && f[0] == username && f[1] == post_id && f[2] == action_type) return true;
    }
    return false;
}

bool toggle_like(const std::string &username, const std::string &post_id) {
    auto lines = read_all_lines(LIKES_CSV);
    std::vector<std::string> out;
    bool removed = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 3 && f[0] == username && f[1] == post_id && f[2] == "like") {
            removed = true;
            continue;
        }
        out.push_back(ln);
    }
    if (removed) {
        write_all_lines(LIKES_CSV, out);
        update_post_counters(post_id, -1, 0);
        return false;
    }
    std::string ts = gen_id();
    std::string new_ln = escape_csv_field(username) + "," + escape_csv_field(post_id) + ",like," + ts;
    append_line(LIKES_CSV, new_ln);
    update_post_counters(post_id, 1, 0);
    return true;
}

bool toggle_favorite(const std::string &username, const std::string &post_id) {
    auto lines = read_all_lines(LIKES_CSV);
    std::vector<std::string> out;
    bool removed = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 3 && f[0] == username && f[1] == post_id && f[2] == "favorite") {
            removed = true;
            continue;
        }
        out.push_back(ln);
    }
    if (removed) {
        write_all_lines(LIKES_CSV, out);
        return false;
    }
    std::string ts = gen_id();
    std::string new_ln = escape_csv_field(username) + "," + escape_csv_field(post_id) + ",favorite," + ts;
    append_line(LIKES_CSV, new_ln);
    return true;
}

json get_user_like_fav_map(const std::string &username) {
    json likes_arr = json::array();
    json favs_arr = json::array();
    auto lines = read_all_lines(LIKES_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 3 || f[0] != username) continue;
        if (f[2] == "like") likes_arr.push_back(f[1]);
        else if (f[2] == "favorite") favs_arr.push_back(f[1]);
    }
    return {{"likes", likes_arr}, {"favorites", favs_arr}};
}

json get_favorite_posts(const std::string &username, int page = 1, int page_size = 20) {
    std::vector<std::string> fav_post_ids;
    auto likes_lines = read_all_lines(LIKES_CSV);
    for (auto &ln : likes_lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 3 && f[0] == username && f[2] == "favorite") fav_post_ids.push_back(f[1]);
    }
    std::reverse(fav_post_ids.begin(), fav_post_ids.end());
    int total = (int)fav_post_ids.size();
    int start = (page - 1) * page_size;
    json items = json::array();
    for (int i = start; i < (int)fav_post_ids.size() && (int)items.size() < page_size; ++i) {
        auto posts = read_posts();
        for (auto &p : posts) {
            if (p.id == fav_post_ids[i] && p.type != "word_upload") {
                items.push_back({{"id", p.id}, {"author", p.author}, {"content", p.content}, {"type", p.type}, {"word", p.word}, {"meaning", p.meaning}, {"example", p.example}, {"created_at", p.created_at}, {"likes_count", p.likes_count}, {"comments_count", p.comments_count}});
                break;
            }
        }
    }
    return {{"total", total}, {"items", items}};
}

// Friends
std::vector<FriendRel> get_friend_rels(const std::string &username) {
    std::vector<FriendRel> rels;
    auto lines = read_all_lines(FRIENDS_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 4) continue;
        if (f[0] == username || f[1] == username) {
            rels.push_back({f[0], f[1], f[2], f[3]});
        }
    }
    return rels;
}

bool has_friend_rel(const std::string &u1, const std::string &u2, const std::string &status = "") {
    auto lines = read_all_lines(FRIENDS_CSV);
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() < 3) continue;
        if ((f[0] == u1 && f[1] == u2) || (f[0] == u2 && f[1] == u1)) {
            if (status.empty() || f[2] == status) return true;
        }
    }
    return false;
}

bool add_friend_rel(const std::string &from, const std::string &to, const std::string &status) {
    if (has_friend_rel(from, to)) return false;
    std::string ts = gen_id();
    std::string ln = escape_csv_field(from) + "," + escape_csv_field(to) + "," + escape_csv_field(status) + "," + ts;
    return append_line(FRIENDS_CSV, ln);
}

bool update_friend_status(const std::string &u1, const std::string &u2, const std::string &new_status) {
    auto lines = read_all_lines(FRIENDS_CSV);
    bool found = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 3 && ((f[0] == u1 && f[1] == u2) || (f[0] == u2 && f[1] == u1))) {
            f[2] = new_status;
            ln.clear();
            for (size_t i = 0; i < f.size(); ++i) {
                ln += escape_csv_field(f[i]);
                if (i + 1 < f.size()) ln.push_back(',');
            }
            found = true;
            break;
        }
    }
    if (!found) return false;
    return write_all_lines(FRIENDS_CSV, lines);
}

bool remove_friend_rel(const std::string &u1, const std::string &u2) {
    auto lines = read_all_lines(FRIENDS_CSV);
    std::vector<std::string> out;
    bool found = false;
    for (auto &ln : lines) {
        auto f = parse_csv_line(ln);
        if (f.size() >= 2 && ((f[0] == u1 && f[1] == u2) || (f[0] == u2 && f[1] == u1))) { found = true; continue; }
        out.push_back(ln);
    }
    if (!found) return false;
    return write_all_lines(FRIENDS_CSV, out);
}

json get_friends_list(const std::string &username) {
    json arr = json::array();
    auto rels = get_friend_rels(username);
    for (auto &r : rels) {
        if (r.status != "accepted") continue;
        std::string friend_name = (r.user1 == username) ? r.user2 : r.user1;
        arr.push_back({{"username", friend_name}, {"since", r.created_at}});
    }
    return arr;
}

json get_friend_requests(const std::string &username) {
    json arr = json::array();
    auto rels = get_friend_rels(username);
    for (auto &r : rels) {
        if (r.status != "pending") continue;
        if (r.user1 == username) continue;
        arr.push_back({{"from", r.user1}, {"created_at", r.created_at}});
    }
    return arr;
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
            if (u.disabled) { res.set_content(make_resp(500, "账号已被禁用"), "application/json"); return; }
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
            bool disabled = f.size() > 7 && f[7] == "1";
            arr.push_back({{"username", f[0]}, {"role", f[2]}, {"total_tests", std::stoi(f[3])}, {"correct", std::stoi(f[4])}, {"accuracy", std::stod(f[5])}, {"streak", std::stoi(f[6])}, {"disabled", disabled}});
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
            // 检查创建者角色，非管理员提交的单词自动设为待审核
            auto creator_opt = find_user(w.creator);
            if (creator_opt && creator_opt->role != "admin") {
                w.status = "待审核";
            }
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
                    std::string created_at = f.size() > 7 ? f[7] : "";
                    std::vector<std::string> fields = {word, meaning, example, pos, origin, creator, status, created_at};
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
        for (auto &w : ws) arr.push_back({{"word", w.word}, {"meaning", w.meaning}, {"example", w.example}, {"pos", w.pos}, {"origin", w.origin}, {"creator", w.creator}, {"status", w.status}, {"created_at", w.created_at}});
        res.set_content(make_resp(200, "ok", arr), "application/json");
    });

    // Random test: POST /api/test/random {username,count,source,letter}
    svr.Post(R"(/api/test/random)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string username = j.value("username", "");
            int count = j.value("count", 10);
            std::string source = j.value("source", "personal");
            std::string letter = j.value("letter", "");
            if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            json arr = json::array();
            if (source == "personal") {
                auto words = random_words_for_user(username, count);
                for (auto &w : words) arr.push_back({{"word", w.word}, {"meaning", w.meaning}, {"example", w.example}, {"pos", w.pos}, {"source", "personal"}});
            } else {
                auto dict = read_dictionary(source);
                if (!letter.empty()) {
                    std::vector<DictEntry> filtered;
                    for (auto &d : dict) {
                        if (!d.word.empty() && std::tolower(d.word[0]) == std::tolower(letter[0]))
                            filtered.push_back(d);
                    }
                    dict = filtered;
                }
                std::random_device rd;
                std::mt19937 g(rd());
                std::shuffle(dict.begin(), dict.end(), g);
                if ((int)dict.size() > count) dict.resize(count);
                for (auto &d : dict) arr.push_back({{"word", d.word}, {"meaning", d.meaning}, {"example", d.example}, {"source", d.source}});
            }
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

    // Dictionary search: GET /api/dictionary/search?q=xxx&source=cet4
    svr.Get(R"(/api/dictionary/search)", [&](const Request &req, Response &res){
        std::string q = req.get_param_value("q");
        std::string source = req.get_param_value("source");
        auto results = search_dictionary(q, source);
        json arr = json::array();
        for (auto &d : results) {
            arr.push_back({{"word", d.word}, {"meaning", d.meaning}, {"source", d.source}, {"example", d.example}, {"frequency", d.frequency}});
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

    // ============ Admin: Dashboard ============
    svr.Get(R"(/api/admin/dashboard)", [&](const Request &req, Response &res){
        try {
            std::string role = req.get_param_value("role");
            if (role != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            res.set_content(make_resp(200, "ok", get_admin_dashboard_stats()), "application/json");
        } catch (std::exception &e) {
            fprintf(stderr, "admin/dashboard error: %s\n", e.what());
            json fallback = {{"total_users", 0}, {"total_words", 0}, {"today_new_words", 0}, {"today_tests", 0}, {"active_users", json::array()}};
            res.set_content(make_resp(200, "ok", fallback), "application/json");
        } catch (...) {
            json fallback = {{"total_users", 0}, {"total_words", 0}, {"today_new_words", 0}, {"today_tests", 0}, {"active_users", json::array()}};
            res.set_content(make_resp(200, "ok", fallback), "application/json");
        }
    });

    // ============ Dictionary Management ============
    svr.Get(R"(/api/dictionary/list)", [&](const Request &req, Response &res){
        std::string q = req.get_param_value("q");
        std::string source = req.get_param_value("source");
        int page = 1, page_size = 50;
        try { page = std::stoi(req.get_param_value("page")); } catch(...) {}
        try { page_size = std::stoi(req.get_param_value("page_size")); } catch(...) {}
        auto results = search_dictionary(q, source);
        int total = (int)results.size();
        int start = (page - 1) * page_size;
        if (start < 0) start = 0;
        int end = start + page_size;
        if (end > total) end = total;
        json arr = json::array();
        for (int i = start; i < end; ++i) {
            auto &d = results[i];
            arr.push_back({{"word", d.word}, {"meaning", d.meaning}, {"source", d.source}, {"example", d.example}, {"frequency", d.frequency}});
        }
        res.set_content(make_resp(200, "ok", {{"total", total}, {"items", arr}}), "application/json");
    });

    svr.Post(R"(/api/dictionary/add)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            DictEntry e;
            e.word = j.value("word", "");
            e.meaning = j.value("meaning", "");
            e.source = j.value("source", "");
            e.example = j.value("example", "");
            e.frequency = j.value("frequency", "");
            if (e.word.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!add_dict_entry(e)) { res.set_content(make_resp(500, "单词已存在"), "application/json"); return; }
            res.set_content(make_resp(200, "添加成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Post(R"(/api/dictionary/update)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string original_word = j.value("original_word", "");
            std::string original_source = j.value("original_source", "");
            DictEntry e;
            e.word = j.value("word", "");
            e.meaning = j.value("meaning", "");
            e.source = j.value("source", "");
            e.example = j.value("example", "");
            e.frequency = j.value("frequency", "");
            if (original_word.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!update_dict_entry(original_word, original_source, e)) { res.set_content(make_resp(500, "单词不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "更新成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Post(R"(/api/dictionary/delete)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string word = j.value("word", "");
            std::string source = j.value("source", "");
            if (word.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!delete_dict_entry(word, source)) { res.set_content(make_resp(500, "单词不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "删除成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // ============ Review Center ============
    svr.Get(R"(/api/admin/review/list)", [&](const Request &req, Response &res){
        std::string role = req.get_param_value("role");
        if (role != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
        std::string status = req.get_param_value("status");
        if (status.empty()) status = "待审核";
        int page = 1, page_size = 50;
        try { page = std::stoi(req.get_param_value("page")); } catch(...) {}
        try { page_size = std::stoi(req.get_param_value("page_size")); } catch(...) {}
        auto words = list_words_by_status(status);
        int total = (int)words.size();
        int start = (page - 1) * page_size;
        if (start < 0) start = 0;
        int end = start + page_size;
        if (end > total) end = total;
        json arr = json::array();
        for (int i = start; i < end; ++i) {
            auto &w = words[i];
            arr.push_back({{"word", w.word}, {"meaning", w.meaning}, {"example", w.example}, {"pos", w.pos}, {"origin", w.origin}, {"creator", w.creator}, {"status", w.status}});
        }
        res.set_content(make_resp(200, "ok", {{"total", total}, {"items", arr}}), "application/json");
    });

    svr.Post(R"(/api/admin/review/approve)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role", "") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            std::string word = j.value("word", "");
            std::string creator = j.value("creator", "");
            if (word.empty() || creator.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!set_word_status(word, creator, "已掌握")) { res.set_content(make_resp(500, "单词不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "审核通过"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Post(R"(/api/admin/review/reject)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role", "") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            std::string word = j.value("word", "");
            std::string creator = j.value("creator", "");
            if (word.empty() || creator.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!set_word_status(word, creator, "已驳回")) { res.set_content(make_resp(500, "单词不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "已驳回"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // ============ Admin: User Management ============
    svr.Post(R"(/api/admin/user/disable)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role", "") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            std::string username = j.value("username", "");
            if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!set_user_disabled(username, true)) { res.set_content(make_resp(500, "用户不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "已禁用"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Post(R"(/api/admin/user/enable)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role", "") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            std::string username = j.value("username", "");
            if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!set_user_disabled(username, false)) { res.set_content(make_resp(500, "用户不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "已启用"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Post(R"(/api/admin/user/reset_password)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role", "") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            std::string username = j.value("username", "");
            std::string new_password = j.value("new_password", "123456");
            if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!admin_reset_password(username, new_password)) { res.set_content(make_resp(500, "用户不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "密码已重置"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Get(R"(/api/admin/user/profile)", [&](const Request &req, Response &res){
        std::string role = req.get_param_value("role");
        if (role != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
        std::string username = req.get_param_value("username");
        if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
        auto uopt = find_user(username);
        if (!uopt) { res.set_content(make_resp(500, "用户不存在"), "application/json"); return; }
        User u = *uopt;
        auto recs = read_all_lines(RECORDS_CSV);
        json errors_arr = json::array();
        int total_words = 0;
        int correct_words = 0;
        for (auto &ln : recs) {
            auto f = parse_csv_line(ln);
            if (f.size() < 6) continue;
            if (f[0] != username) continue;
            total_words++;
            int result = std::stoi(f[2]);
            if (result == 1) correct_words++;
            else errors_arr.push_back({{"word", f[1]}, {"ts", f[5]}});
        }
        std::unordered_set<std::string> mastered;
        for (auto &ln : recs) {
            auto f = parse_csv_line(ln);
            if (f.size() < 6 || f[0] != username) continue;
            if (std::stoi(f[2]) == 1) mastered.insert(f[1]);
        }
        json data = {
            {"username", u.username}, {"role", u.role}, {"total_tests", u.total_tests},
            {"correct", u.correct}, {"accuracy", u.accuracy}, {"streak", u.streak},
            {"disabled", u.disabled}, {"mastered_count", (int)mastered.size()},
            {"total_words_tested", total_words}, {"errors", errors_arr}
        };
        res.set_content(make_resp(200, "ok", data), "application/json");
    });

    // ============ Admin: Game Records ============
    svr.Get(R"(/api/admin/game_records)", [&](const Request &req, Response &res){
        std::string role = req.get_param_value("role");
        if (role != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
        int page = 1, page_size = 50;
        try { page = std::stoi(req.get_param_value("page")); } catch(...) {}
        try { page_size = std::stoi(req.get_param_value("page_size")); } catch(...) {}
        auto lines = read_all_lines(GAME_RECORDS_CSV);
        int total = (int)lines.size();
        int start = (page - 1) * page_size;
        if (start < 0) start = 0;
        int end = start + page_size;
        if (end > total) end = total;
        json arr = json::array();
        for (int i = start; i < end; ++i) {
            auto f = parse_csv_line(lines[i]);
            if (f.size() < 6) continue;
            arr.push_back({{"username", f[0]}, {"game_time", f[1]}, {"total_score", std::stoi(f[2])}, {"chain_len", std::stoi(f[3])}, {"used_words", f[4]}, {"duration", std::stod(f[5])}});
        }
        res.set_content(make_resp(200, "ok", {{"total", total}, {"items", arr}}), "application/json");
    });

    svr.Post(R"(/api/admin/game_records/delete)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role", "") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            std::string username = j.value("username", "");
            std::string game_time = j.value("game_time", "");
            if (username.empty() || game_time.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!delete_game_record(username, game_time)) { res.set_content(make_resp(500, "记录不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "删除成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // ============ Word Contribution (to global dictionary) ============
    svr.Post(R"(/api/word/contribute)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            Contribution c;
            c.word = j.value("word", "");
            c.meaning = j.value("meaning", "");
            c.example = j.value("example", "");
            c.pos = j.value("pos", "");
            c.creator = j.value("creator", "");
            c.status = "待审核";
            if (c.word.empty() || c.creator.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!add_contribution(c)) { res.set_content(make_resp(500, "该单词已提交过"), "application/json"); return; }
            res.set_content(make_resp(200, "提交成功，等待管理员审核"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // ============ Admin: Contribution Review ============
    svr.Get(R"(/api/admin/contributions/list)", [&](const Request &req, Response &res){
        std::string role = req.get_param_value("role");
        if (role != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
        std::string status = req.get_param_value("status");
        if (status.empty()) status = "待审核";
        int page = 1, page_size = 50;
        try { page = std::stoi(req.get_param_value("page")); } catch(...) {}
        try { page_size = std::stoi(req.get_param_value("page_size")); } catch(...) {}
        auto items = list_contributions(status);
        int total = (int)items.size();
        int start = (page - 1) * page_size;
        if (start < 0) start = 0;
        int end = start + page_size;
        if (end > total) end = total;
        json arr = json::array();
        for (int i = start; i < end; ++i) {
            auto &c = items[i];
            arr.push_back({{"word", c.word}, {"meaning", c.meaning}, {"example", c.example}, {"pos", c.pos}, {"creator", c.creator}, {"status", c.status}});
        }
        res.set_content(make_resp(200, "ok", {{"total", total}, {"items", arr}}), "application/json");
    });

    svr.Post(R"(/api/admin/contributions/approve)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role", "") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            std::string word = j.value("word", "");
            std::string creator = j.value("creator", "");
            std::string meaning = j.value("meaning", "");
            std::string example = j.value("example", "");
            std::string pos = j.value("pos", "");
            if (word.empty() || creator.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            // Add to global dictionary
            DictEntry e{word, meaning, "user_contribution", example, "medium"};
            if (!add_dict_entry(e)) { res.set_content(make_resp(500, "该单词已在词典中存在"), "application/json"); return; }
            // Mark contribution as approved
            if (!set_contribution_status(word, creator, "已通过")) { res.set_content(make_resp(500, "贡献记录不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "审核通过，已加入全局词典"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Post(R"(/api/admin/contributions/reject)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role", "") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            std::string word = j.value("word", "");
            std::string creator = j.value("creator", "");
            if (word.empty() || creator.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!set_contribution_status(word, creator, "已驳回")) { res.set_content(make_resp(500, "贡献记录不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "已驳回"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // ============ Community: Posts ============
    svr.Post(R"(/api/community/post/create)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string author = j.value("username", "");
            std::string content = j.value("content", "");
            std::string type = j.value("type", "post");
            std::string word = j.value("word", "");
            std::string meaning = j.value("meaning", "");
            std::string example = j.value("example", "");
            if (author.empty() || content.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            Post p;
            p.id = gen_id();
            p.author = author;
            p.content = content;
            p.type = type;
            p.word = word;
            p.meaning = meaning;
            p.example = example;
            p.created_at = gen_id();
            p.likes_count = 0;
            p.comments_count = 0;
            if (!append_post(p)) { res.set_content(make_resp(500, "发布失败"), "application/json"); return; }
            if (type == "word_upload" && !word.empty()) {
                Contribution c;
                c.word = word;
                c.meaning = meaning;
                c.example = example;
                c.pos = "";
                c.creator = author;
                c.status = "待审核";
                c.created_at = p.created_at;
                add_contribution(c);
            }
            res.set_content(make_resp(200, "发布成功", {{"id", p.id}, {"created_at", p.created_at}}), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Get(R"(/api/community/posts)", [&](const Request &req, Response &res){
        int page = std::stoi(req.get_param_value("page").empty() ? "1" : req.get_param_value("page"));
        int page_size = std::stoi(req.get_param_value("page_size").empty() ? "20" : req.get_param_value("page_size"));
        std::string type = req.get_param_value("type");
        std::string username = req.get_param_value("username");
        auto posts = read_posts(type);
        int total = (int)posts.size();
        int start = (page - 1) * page_size;
        json items = json::array();
        json user_map = get_user_like_fav_map(username);
        for (int i = start; i < (int)posts.size() && (int)items.size() < page_size; ++i) {
            auto &p = posts[i];
            bool is_liked = false, is_fav = false;
            if (!username.empty()) {
                for (auto &lid : user_map["likes"]) { if (lid == p.id) { is_liked = true; break; } }
                for (auto &fid : user_map["favorites"]) { if (fid == p.id) { is_fav = true; break; } }
            }
            items.push_back({{"id", p.id}, {"author", p.author}, {"content", p.content}, {"type", p.type}, {"word", p.word}, {"meaning", p.meaning}, {"example", p.example}, {"created_at", p.created_at}, {"likes_count", p.likes_count}, {"comments_count", p.comments_count}, {"is_liked", is_liked}, {"is_fav", is_fav}});
        }
        res.set_content(make_resp(200, "ok", {{"total", total}, {"items", items}}), "application/json");
    });

    svr.Post(R"(/api/community/post/delete)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string post_id = j.value("post_id", "");
            std::string username = j.value("username", "");
            if (post_id.empty() || username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            auto posts = read_posts();
            bool is_author = false, is_admin = false;
            for (auto &p : posts) {
                if (p.id == post_id) { is_author = (p.author == username); break; }
            }
            auto uopt = find_user(username);
            if (uopt && uopt->role == "admin") is_admin = true;
            if (!is_author && !is_admin) { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            if (!delete_post_by_id(post_id)) { res.set_content(make_resp(500, "帖子不存在"), "application/json"); return; }
            delete_comments_by_post_id(post_id);
            res.set_content(make_resp(200, "删除成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // ============ Community: Comments ============
    svr.Post(R"(/api/community/comment/create)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string post_id = j.value("post_id", "");
            std::string author = j.value("username", "");
            std::string content = j.value("content", "");
            if (post_id.empty() || author.empty() || content.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            Comment c;
            c.id = gen_id();
            c.post_id = post_id;
            c.author = author;
            c.content = content;
            c.created_at = gen_id();
            if (!append_comment(c)) { res.set_content(make_resp(500, "评论失败"), "application/json"); return; }
            update_post_counters(post_id, 0, 1);
            res.set_content(make_resp(200, "评论成功", {{"id", c.id}, {"created_at", c.created_at}}), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Get(R"(/api/community/comments)", [&](const Request &req, Response &res){
        std::string post_id = req.get_param_value("post_id");
        if (post_id.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
        auto comments = read_comments(post_id);
        json arr = json::array();
        for (auto &c : comments) {
            arr.push_back({{"id", c.id}, {"post_id", c.post_id}, {"author", c.author}, {"content", c.content}, {"created_at", c.created_at}});
        }
        res.set_content(make_resp(200, "ok", arr), "application/json");
    });

    svr.Post(R"(/api/community/comment/delete)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string comment_id = j.value("comment_id", "");
            std::string username = j.value("username", "");
            if (comment_id.empty() || username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            auto comments = read_comments();
            std::string post_id, author;
            for (auto &c : comments) { if (c.id == comment_id) { post_id = c.post_id; author = c.author; break; } }
            if (author.empty()) { res.set_content(make_resp(500, "评论不存在"), "application/json"); return; }
            bool is_admin = false;
            auto uopt = find_user(username);
            if (uopt && uopt->role == "admin") is_admin = true;
            if (author != username && !is_admin) { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            if (!delete_comment_by_id(comment_id)) { res.set_content(make_resp(500, "删除失败"), "application/json"); return; }
            update_post_counters(post_id, 0, -1);
            res.set_content(make_resp(200, "删除成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // ============ Community: Likes & Favorites ============
    svr.Post(R"(/api/community/toggle_like)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string username = j.value("username", "");
            std::string post_id = j.value("post_id", "");
            if (username.empty() || post_id.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            bool liked = toggle_like(username, post_id);
            int count = 0;
            auto likes_lines = read_all_lines(LIKES_CSV);
            for (auto &ln : likes_lines) {
                auto f = parse_csv_line(ln);
                if (f.size() >= 3 && f[1] == post_id && f[2] == "like") count++;
            }
            res.set_content(make_resp(200, "ok", {{"liked", liked}, {"likes_count", count}}), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Post(R"(/api/community/toggle_favorite)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string username = j.value("username", "");
            std::string post_id = j.value("post_id", "");
            if (username.empty() || post_id.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            bool fav = toggle_favorite(username, post_id);
            res.set_content(make_resp(200, "ok", {{"favorited", fav}}), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Get(R"(/api/community/my_favorites)", [&](const Request &req, Response &res){
        std::string username = req.get_param_value("username");
        int page = std::stoi(req.get_param_value("page").empty() ? "1" : req.get_param_value("page"));
        if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
        res.set_content(make_resp(200, "ok", get_favorite_posts(username, page)), "application/json");
    });

    // ============ Community: Friends ============
    svr.Post(R"(/api/community/friend/request)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string from = j.value("from_user", "");
            std::string to = j.value("to_user", "");
            if (from.empty() || to.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (from == to) { res.set_content(make_resp(500, "不能添加自己"), "application/json"); return; }
            if (!find_user(to)) { res.set_content(make_resp(500, "目标用户不存在"), "application/json"); return; }
            if (has_friend_rel(from, to)) { res.set_content(make_resp(500, "已存在好友关系或申请"), "application/json"); return; }
            if (!add_friend_rel(from, to, "pending")) { res.set_content(make_resp(500, "发送失败"), "application/json"); return; }
            res.set_content(make_resp(200, "好友申请已发送"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Post(R"(/api/community/friend/accept)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string from = j.value("from_user", "");
            std::string to = j.value("to_user", "");
            if (from.empty() || to.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!update_friend_status(from, to, "accepted")) { res.set_content(make_resp(500, "申请不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "已接受"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Post(R"(/api/community/friend/remove)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            std::string u1 = j.value("user1", "");
            std::string u2 = j.value("user2", "");
            if (u1.empty() || u2.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!remove_friend_rel(u1, u2)) { res.set_content(make_resp(500, "关系不存在"), "application/json"); return; }
            res.set_content(make_resp(200, "已删除"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Get(R"(/api/community/friends)", [&](const Request &req, Response &res){
        std::string username = req.get_param_value("username");
        if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
        res.set_content(make_resp(200, "ok", get_friends_list(username)), "application/json");
    });

    svr.Get(R"(/api/community/friend/requests)", [&](const Request &req, Response &res){
        std::string username = req.get_param_value("username");
        if (username.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
        res.set_content(make_resp(200, "ok", get_friend_requests(username)), "application/json");
    });

    // ============ Admin: Community Management ============
    svr.Get(R"(/api/admin/community/posts)", [&](const Request &req, Response &res){
        std::string role = req.get_param_value("role");
        if (role != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
        int page = std::stoi(req.get_param_value("page").empty() ? "1" : req.get_param_value("page"));
        int page_size = std::stoi(req.get_param_value("page_size").empty() ? "20" : req.get_param_value("page_size"));
        auto posts = read_posts();
        json items = json::array();
        int total = 0;
        for (auto &p : posts) {
            if (p.type == "word_upload") continue;
            total++;
            if ((int)items.size() >= page_size) continue;
            items.push_back({{"id", p.id}, {"author", p.author}, {"content", p.content}, {"type", p.type}, {"created_at", p.created_at}, {"likes_count", p.likes_count}, {"comments_count", p.comments_count}});
        }
        auto all_items = json::array();
        int start = (page - 1) * page_size;
        int end = std::min((int)items.size(), start + page_size);
        for (int i = start; i < end; ++i) all_items.push_back(items[i]);
        res.set_content(make_resp(200, "ok", {{"total", total}, {"items", all_items}}), "application/json");
    });

    svr.Post(R"(/api/admin/community/post/delete)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role", "") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            std::string post_id = j.value("post_id", "");
            if (post_id.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            if (!delete_post_by_id(post_id)) { res.set_content(make_resp(500, "帖子不存在"), "application/json"); return; }
            delete_comments_by_post_id(post_id);
            res.set_content(make_resp(200, "删除成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    svr.Post(R"(/api/admin/community/comment/delete)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role", "") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            std::string comment_id = j.value("comment_id", "");
            if (comment_id.empty()) { res.set_content(make_resp(500, "参数缺失"), "application/json"); return; }
            auto comments = read_comments();
            std::string post_id;
            for (auto &c : comments) { if (c.id == comment_id) { post_id = c.post_id; break; } }
            if (!delete_comment_by_id(comment_id)) { res.set_content(make_resp(500, "评论不存在"), "application/json"); return; }
            if (!post_id.empty()) update_post_counters(post_id, 0, -1);
            res.set_content(make_resp(200, "删除成功"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    // ============ Admin: System Config ============
    svr.Get(R"(/api/admin/config)", [&](const Request &req, Response &res){
        std::string role = req.get_param_value("role");
        if (role != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
        res.set_content(make_resp(200, "ok", load_config()), "application/json");
    });

    svr.Post(R"(/api/admin/config)", [&](const Request &req, Response &res){
        try {
            auto j = json::parse(req.body);
            if (j.value("role", "") != "admin") { res.set_content(make_resp(500, "无权限"), "application/json"); return; }
            json cfg = load_config();
            if (j.contains("announcement")) cfg["announcement"] = j["announcement"];
            if (j.contains("maintenance_mode")) cfg["maintenance_mode"] = j["maintenance_mode"];
            if (j.contains("maintenance_message")) cfg["maintenance_message"] = j["maintenance_message"];
            if (!save_config(cfg)) { res.set_content(make_resp(500, "保存失败"), "application/json"); return; }
            res.set_content(make_resp(200, "配置已更新"), "application/json");
        } catch (...) { res.set_content(make_resp(500, "参数解析失败"), "application/json"); }
    });

    printf("Starting server on http://0.0.0.0:8080\n");
    svr.listen("0.0.0.0", 8080);
    return 0;
}
