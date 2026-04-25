cmake_minimum_required(VERSION 3.16)
project(lexical_sanctuary_backend LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Windows 平台需要链接 ws2_32（Winsock）
if(WIN32)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -DCPPHTTPLIB_KEEPALIVE_MAX_COUNT=5")
endif()

# 头文件搜索路径
include_directories(${CMAKE_SOURCE_DIR}/include)
include_directories(${CMAKE_SOURCE_DIR}/src)

# 收集源文件
file(GLOB_RECURSE SOURCES
    "src/*.cpp"
)

# 构建可执行文件
add_executable(${PROJECT_NAME} ${SOURCES})

# Windows 平台链接 Winsock
if(WIN32)
    target_link_libraries(${PROJECT_NAME} ws2_32)
endif()

# 确保编译时正确处理 Unicode
if(MSVC)
    target_compile_options(${PROJECT_NAME} PRIVATE /utf-8)
else()
    target_compile_options(${PROJECT_NAME} PRIVATE -finput-charset=UTF-8 -fexec-charset=UTF-8)
endif()
