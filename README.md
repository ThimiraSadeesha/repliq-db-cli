# Database Backup CLI Tool

A comprehensive, production-ready command-line tool for backing up and restoring databases. Supports MySQL, PostgreSQL, and MongoDB with multiple storage options including local and cloud storage (AWS S3, Google Cloud Storage, Azure Blob Storage).

## ✨ Features

- 🗄️ **Multiple Database Support**: MySQL, PostgreSQL, MongoDB
- 📦 **Backup Types**: Full, incremental, and differential backups
- 🗜️ **Compression**: Automatic compression to save storage space
- ☁️ **Cloud Storage**: Support for AWS S3, Google Cloud Storage, Azure Blob Storage
- 📢 **Notifications**: Slack notifications for backup completion
- 📊 **Logging**: Comprehensive logging of all operations
- 🔒 **Security**: Secure credential handling and SSH support
- ⚡ **Performance**: Optimized for large databases
- 🖥️ **Cross-Platform**: Works on Windows, Linux, and macOS

## 📋 Requirements

- Node.js 18.0 or higher
- Database client tools:
    - MySQL: `mysql-client` and `mysqldump`
    - PostgreSQL: `postgresql-client` and `pg_dump`
    - MongoDB: `mongodb-clients` and `mongodump`
