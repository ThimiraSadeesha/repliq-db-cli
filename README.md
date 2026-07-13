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

### npm

```bash
npm install -g repliq-db
```

### Homebrew

```bash
brew tap ThimiraSadeesha/tap
brew install repliq-db
```

Upgrade later with:

```bash
brew update
brew upgrade repliq-db
```

---

## 🏷 Releasing (npm + Homebrew via GitHub Actions)

Releases are automated from git tags.

1. Bump `version` in `package.json` (example: `1.0.11`).
2. Commit and push to `main`.
3. Create and push a matching tag:

```bash
git tag v1.0.11
git push origin v1.0.11
```

That runs [.github/workflows/release.yml](.github/workflows/release.yml):

1. Build + test
2. Publish to [npm](https://www.npmjs.com/package/repliq-db)
3. Update [homebrew-tap](https://github.com/ThimiraSadeesha/homebrew-tap)
4. Create a GitHub Release

### Required GitHub secrets

In [repliq-db-cli](https://github.com/ThimiraSadeesha/repliq-db-cli) → **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
| --- | --- |
| `NPM_TOKEN` | npm Automation token with publish permission |
| `HOMEBREW_TAP_TOKEN` | GitHub PAT with `contents:write` on `ThimiraSadeesha/homebrew-tap` |

Also attach the workflow to a GitHub Environment named `production` (or remove `environment: production` from the release workflow).

### Create the secrets

**NPM_TOKEN**

1. https://www.npmjs.com/settings/~/tokens
2. Generate **Automation** token (bypasses 2FA in CI)
3. Add as `NPM_TOKEN`

**HOMEBREW_TAP_TOKEN**

1. https://github.com/settings/tokens
2. Create a classic PAT with `repo` scope (or a fine-grained token with Contents read/write on `homebrew-tap`)
3. Add as `HOMEBREW_TAP_TOKEN`
