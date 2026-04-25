#pragma once

#include <string>
#include <vector>
#include <fstream>
#include <sstream>
#include <filesystem>

/**
 * @brief CSV 文件读写工具类
 * 支持带引号字段的解析和文件的安全读写
 */
class CsvHelper {
public:
    /**
     * @brief 解析单行 CSV 为字段数组
     * 支持双引号包裹的字段（内含逗号）
     * @param line CSV 行文本
     * @return 字段字符串数组
     */
    static std::vector<std::string> parseLine(const std::string& line) {
        std::vector<std::string> fields;
        std::string field;
        bool inQuotes = false;

        for (size_t i = 0; i < line.size(); ++i) {
            char c = line[i];
            if (c == '"') {
                if (inQuotes && i + 1 < line.size() && line[i + 1] == '"') {
                    // 转义的双引号
                    field += '"';
                    ++i;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                fields.push_back(field);
                field.clear();
            } else {
                field += c;
            }
        }
        fields.push_back(field);
        return fields;
    }

    /**
     * @brief 读取 CSV 文件的所有数据行（跳过表头）
     * @param filePath 文件路径
     * @return 每行解析后的字段数组列表
     */
    static std::vector<std::vector<std::string>> readAll(const std::string& filePath) {
        std::vector<std::vector<std::string>> rows;
        std::ifstream file(filePath);
        if (!file.is_open()) return rows;

        std::string line;
        // 跳过表头
        if (std::getline(file, line)) {
            // 表头已跳过
        }

        while (std::getline(file, line)) {
            if (line.empty()) continue;
            // 移除可能的 \r
            if (!line.empty() && line.back() == '\r') {
                line.pop_back();
            }
            rows.push_back(parseLine(line));
        }

        file.close();
        return rows;
    }

    /**
     * @brief 追加一行数据到 CSV 文件
     * @param filePath 文件路径
     * @param csvLine CSV 格式的数据行
     */
    static void appendLine(const std::string& filePath, const std::string& csvLine) {
        std::ofstream file(filePath, std::ios::app);
        if (file.is_open()) {
            file << csvLine << "\n";
            file.close();
        }
    }

    /**
     * @brief 重写整个 CSV 文件（含表头）
     * @param filePath 文件路径
     * @param header 表头行
     * @param lines 所有数据行
     */
    static void writeAll(const std::string& filePath,
                         const std::string& header,
                         const std::vector<std::string>& lines) {
        std::ofstream file(filePath, std::ios::trunc);
        if (file.is_open()) {
            file << header << "\n";
            for (const auto& line : lines) {
                file << line << "\n";
            }
            file.close();
        }
    }

    /**
     * @brief 确保文件存在，若不存在则创建并写入表头
     * @param filePath 文件路径
     * @param header CSV 表头
     */
    static void ensureFile(const std::string& filePath, const std::string& header) {
        if (!std::filesystem::exists(filePath)) {
            // 确保目录存在
            auto parentPath = std::filesystem::path(filePath).parent_path();
            if (!parentPath.empty()) {
                std::filesystem::create_directories(parentPath);
            }
            std::ofstream file(filePath);
            if (file.is_open()) {
                file << header << "\n";
                file.close();
            }
        }
    }

    /**
     * @brief 生成下一个自增 ID
     * @param rows 已有数据行
     * @return 新的 ID 字符串
     */
    static std::string nextId(const std::vector<std::vector<std::string>>& rows) {
        int maxId = 0;
        for (const auto& row : rows) {
            if (!row.empty()) {
                try {
                    int id = std::stoi(row[0]);
                    if (id > maxId) maxId = id;
                } catch (...) {}
            }
        }
        return std::to_string(maxId + 1);
    }

    /**
     * @brief 获取当前时间字符串 (ISO 8601 格式)
     * @return 时间字符串
     */
    static std::string nowString() {
        auto now = std::chrono::system_clock::now();
        auto time = std::chrono::system_clock::to_time_t(now);
        std::tm tm{};
#ifdef _WIN32
        localtime_s(&tm, &time);
#else
        localtime_r(&time, &tm);
#endif
        char buf[32];
        std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", &tm);
        return std::string(buf);
    }
};
