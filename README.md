# Repliq DB - Database Backup & Copy CLI Tool

A simple, reliable, and production-ready command-line tool for **backing up and copying relational databases** between a source and target database. Designed to handle **tables, data, views, triggers, stored procedures, functions, and events**.

---

## ✨ Features

* 🗄️ **Full Relational Database Support** – Works with MySQL/MariaDB databases.
* 📦 **Backup** – Export full database including all objects and data to a `.sql` file.
* 🔄 **Copy/Clone** – Copy database from a source to a target database, even across different hosts.
* 🔒 **Secure** – Handles credentials safely and prevents accidental data loss.
* ⚡ **Optimized** – Efficiently handles large databases with batching and proper escape handling.
* 🖥️ **Cross-Platform** – Works on Windows, Linux, and macOS.
* ✅ **Supports All Database Objects** – Tables, views, triggers, stored procedures, functions, and events are fully included.
* 📝 **Custom Backup Location** – Choose where backups are saved.
* 🎯 **Interactive CLI** – Easy-to-use interactive menu for all operations.

---

## 📋 Requirements

* Node.js 18.0 or higher
* MySQL / MariaDB database
* NPM (for global installation)

---

## 🚀 Installation

Install globally via NPM:

```bash
  npm install -g repliq-db
