---
project: Beancount Project Management
created: 2025-09-22T00:00:00.000Z
views:
  default:
    group_by: status
    sort_by: created
    sort_order: desc
columns:
  - field: id
    width: 60
  - field: title
    width: 400
  - field: status
    width: 100
  - field: assignee
    width: 100
  - field: milestone
    width: 180
  - field: created
    width: 110
  - field: done
    width: 110
status_options:
  - todo
  - done
  - in_progress
priority_options:
  - urgent
  - high
  - medium
  - low
assignee_options:
  - Guodong
  - Tian
---

# Beancount Project Management

## Tasks

| Id | Title | Status | Assignee | Milestone | Created | Done |
| --- | --- | --- | --- | --- | --- | --- |
| 060 | add AI CFO to write / create PR | todo | Tian | [AI-Powered Accounting](https://github.com/stargately/pm/blob/main/src/knowledge-base/100-Beancount.io/113-Product-Specs/113.19-prfaq-beancount-ai.md) | 2025-10-13 |  |
| 061 | unblock all users | todo | Tian |  | 2025-10-13 | 2026-02-25 |
| 062 | update auto-importer landing pages | todo | Tian | beancount | 2025-10-20 | 2026-02-25 |
| 065 | connect to plaid launch prep, landing pages and blog announcement | todo | Guodong | beancount | 2025-10-20 | 2026-02-25 |
| 089 | update documentation for mature features | todo | Guodong | beancount-v3.1 | 2025-10-13 |  |
| 091 | add account settings to import data (mobile) | todo | Tian | beancount-v3.1 | 2025-10-13 |  |
| 093 | add 自动显示 README.md to overview or files page | todo | Tian | Open Ledger & Social Profiles | 2025-11-01 |  |
| 095 | crypto - domain specific example of beancount setup and embed to documentation | todo |  | Open Ledger & Social Profiles | 2025-11-01 |  |
| 096 | real estate - domain specific example of beancount setup and embed to documentation | todo |  | Open Ledger & Social Profiles | 2025-11-01 |  |
| 097 | redesign co:image for [beancount.io](http://beancount.io/) | todo | Tian |  | 2025-11-01 |  |
| 098 | how to manage swagger file with https://api.v3.beancount.io/api-docs/swagger.json exposure? (currently, it is not exported in production env)) | todo |  |  | 2025-11-01 |  |
| 100 | tanstack start investigation ssr | todo | Guodong |  | 2025-10-09 |  |
| 101 | logger review | todo |  | beancount | 2025-10-20 |  |
| 102 | metabase connection | todo |  | beancount | 2025-10-20 |  |
| 105 | update welcome email | todo |  | beancount | 2025-10-20 |  |
| 107 | backend-v2 add forum sso | todo |  | beancount-v3 | 2025-09-26 |  |
| 108 | query string to filter prefill https://fava.pythonanywhere.com/example-beancount-file/balance_sheet/?conversion=at_value&interval=quarter (+10823.44) | todo |  | beancount-v3 | 2025-09-26 |  |
| 109 | customize query to sidebar https://beancount.io/docs/Tips/side-bar-link | todo |  | beancount-v3.? | 2025-10-13 |  |
| 112 | use cloudflare turnstile to prevent bot attack (need to bind [beancount.io](http://beancount.io/) to cloudflare) | todo |  | beancount-v3.? | 2025-10-13 |  |
| 114 | ads for free user | todo | Guodong | beancount-v3.1 | 2025-10-13 |  |
| 116 | Beancount-mobile GitHub copywriting | todo |  | beancount-v3.1 | 2025-10-13 |  |
| 125 | inivite user to register and share ledger to her | todo |  | beancount-v3.1 | 2025-10-13 |  |
| 130 | build agent native organization | todo |  | beancount-v3.1 | 2025-10-13 |  |
| 131 | feedback collector widget | todo |  | beancount-v3.1 | 2025-10-13 |  |
| 142 | Zero down time deploy | todo |  | beancount-v3.1 | 2025-10-13 |  |
| 146 | Monaco editor bad on mobile | todo |  | beancount-v3.1 | 2025-10-13 |  |
| 149 | editor experience | todo |  | beancount-v3.1 | 2025-10-13 |  |
| 150 | deprecate sign-in and sign-up REST API | todo |  | beancount-v3.1 | 2025-10-13 |  |
| 151 | Email i18n | todo |  | beancount-v3.1 | 2025-10-13 |  |
| 152 | Debug mode disabled | todo |  | beancount-v3.1 | 2025-10-13 |  |
| 153 | integrate with github for deploy, PR and contribute | todo |  | Github integration | 2025-11-01 |  |
| 154 | user's invoice persistence | todo |  |  | 2025-11-01 |  |
| 156 | ❌ (security issues) how to segragate internal apis from public access, internal access token | todo |  |  | 2025-10-20 |  |
| 159 | Surface forum discussions | todo |  |  | 2025-10-09 |  |
| 160 | https://github.com/githubnext/gh-aw | todo |  |  | 2025-10-09 |  |
| 164 | ?migrate translate to use TranslateGemma? | todo |  |  | 2025-10-20 |  |
| 165 | learn growth from https://www.befreed.ai/ | todo |  |  | 2025-10-20 |  |
| 171 | account operations / manage | todo | Guodong | beancount-v3.1 | 2025-10-13 |  |
| 172 | PRFAQ tax prep tools | todo |  |  | 2025-10-13 |  |
| 173 | Android app must support 16kb memory page sizes https://www.reddit.com/r/expo/comments/1nep9sc/app_must_support_16_kb_memory_page_sizes/ | todo |  |  | 2025-10-13 |  |
| 174 | 财报GTM | todo |  |  | 2025-10-13 |  |
| 175 | google analytics mcp | todo |  |  | 2025-10-13 |  |
| 176 | how to leverage https://blog.cloudflare.com/markdown-for-agents | todo |  |  | 2025-10-13 |  |
| 179 | update to new admin token 36k27 | todo |  |  | 2025-10-09 |  |
| 181 | optimize dashboard performance | todo | Guodong | beancount-v3.1 | 2025-10-13 |  |
| 182 | write PRFAQ mobile v3.5 | todo |  |  | 2025-10-13 |  |
| 001 | use gemini to translate - founder resources hub and new blogs | done |  |  | 2025-09-22 | 2025-10-09 |
| 002 | auto deploy by git push | done | Tian | beancount-v3 | 2025-10-02 | 2025-10-09 |
| 003 | deploy https://blockeden.xyz/dash/ws_iyUG9p5zQHM3E7VDnBQn/projects/srv-web-beancount | done | Tian | beancount-v3 | 2025-10-02 | 2025-10-09 |
| 004 | [rollout] dashboard should support webview login | done |  | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 005 | build dashboard in [metrics.blockeden.xyz](http://metrics.blockeden.xyz/) - endpoint is prepared | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 006 | 🔥 holiday calendar | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-10 |
| 007 | test coverage for all services | done | Guodong | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 008 | polish mobile UI styles and publish new versions | done |  |  | 2025-09-22 | 2025-10-09 |
| 009 | discourse forum v1 | done |  |  | 2025-09-22 | 2025-10-09 |
| 010 | 🔥 add vmiss to backstage | done | Guodong |  | 2025-10-16 | 2025-10-16 |
| 011 | [update Beancount 系统迁移指南](https://stargately.com/internal/zh/2025/08/29/mongo-gitea-migration-guide) | done | Guodong | beancount-v3 | 2025-09-24 | 2025-10-09 |
| 012 | beancount-mobile release is broken after bumping expo | done | Tian |  | 2025-09-22 | 2025-10-09 |
| 013 | forum login problem | done | Tian |  | 2025-09-22 | 2025-10-09 |
| 014 | Completed the development of the ledger-server API, including modules for balance-sheet, income-statement, journal, query, holdings,  commodities, document, and user invitation | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-03 |
| 015 | complete web dashboard feature | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-10 |
| 016 | Adapted and fixed mobile compatibility, ensuring that the previous APIs  continue to function properly under the new API. | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-14 |
| 017 | suport testnet env | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-10 |
| 018 | buy github copilot and claude code | done | Guodong | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 019 | ledger sharing | done | Guodong | beancount-v3 | 2025-10-09 | 2025-10-16 |
| 020 | load production data into [dashboard.v3.beancount.io](http://dashboard.v3.beancount.io/) | done | Tian | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 021 | added initial beancount metrics - beancount backend | done | Guodong | beancount-v3 | 2025-09-22 | 2025-10-10 |
| 022 | SEO headers for https://beancount.io/ledger/open_ledger/example/overview | done |  | beancount | 2025-10-20 | 2025-11-15 |
| 023 | update database primary key to make to more semantic | done | Guodong | beancount | 2025-10-20 | 2025-11-15 |
| 024 | ledger options https://beancount.io/ledger/0/options/ | done | Tian | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 025 | proof of concept for beancount ai | done | Tian | beancount-v3.1 | 2025-09-22 | 2025-10-09 |
| 026 | document all cloud hosting usage in https://stargately.com/internal/backstage | done |  |  | 2025-10-09 | 2025-10-13 |
| 027 | polish mobile UI styles | done |  |  | 2025-09-22 | 2025-10-09 |
| 028 | [internal API dashboard / make it easy to discover & develop against internal APIs / onboard swagger openapi](https://github.com/asteasolutions/zod-to-openapi) | done | Tian |  | 2025-10-09 | 2025-10-13 |
| 029 | load testing and capacity planning for git-based project and if performance is good then how to migrate seamlessly | done | Guodong |  | 2025-09-22 | 2025-10-09 |
| 030 | add /openapi.json to services | done |  |  | 2025-10-09 | 2025-10-13 |
| 031 | bug fixes & feature parity & documentation | done |  |  | 2025-10-09 | 2025-10-13 |
| 032 | pricing tiers and payment wall 🔥 | done | Tian | monetization | 2025-10-09 | 2025-10-16 |
| 033 | migrate off mailgun | done |  |  | 2025-10-09 | 2025-10-16 |
| 034 | update pricing plans | done | Tian | monetization | 2025-10-09 | 2025-10-16 |
| 035 | investigate how to sync | done | Guodong | plaid poc | 2025-10-20 | 2025-11-15 |
| 036 | sqlite vs postgresql for gitea - choose postgresql and mount from data volumne - use postgresql | done |  | beancount-v3 | 2025-09-22 | 2025-10-03 |
| 037 | Backend vs backend v2 | done |  | beancount-v3 | 2025-09-22 | 2025-10-03 |
| 038 | not found error for private repo  in https://dashboard.v3.beancount.io/ledger/test2/overview      Unexpected error value: { data: null, error: { success: false, error: "(404)\nReason: Not Found\nHTTP response headers: HTTPHeaderDict({'Cache-Control': 'max-age=0, private, must-revalidate, no-transform', 'Content-Type': 'application/json;charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Date': 'Mon, 13 Oct 2025 03:06:56 GMT', 'Content-Length': '106'})\nHTTP response body: {\"errors\":null,\"message\":\"The target couldn't be found.\",\"url\":\"https://git.v3.beancount.io/api/swagger\"}\n\n" } } | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 039 | migrate off mailgun | done |  |  | 2025-10-09 | 2025-10-16 |
| 040 | data loaders: v2-mongodb-to-v3 and v3 mongodb+ (gitea -> v3 mongodb) cronjob | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 041 | [rollout] login as paid user and see if v3 is different in experience. e.g. multi-currency | done |  | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 042 | [rollout] mobile fava - web-beancount/beancount-dashboard/src/pages/auth/index.tsx | done |  | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 043 | [rollout] pricing plans details | done | Tian | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 044 | design for overview | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 045 | make content more compact in income statement | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-13 |
| 046 | /income_statement/?conversion=at_value&interval=quarter | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 047 | income_statement more kinds of charts (imporove chart) | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 048 | [rollout] rollout plan - feature parity comparison | done | Tian | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 049 | trial balance | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 050 | journal attributes of table, and order | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 051 | [rollout] security review, e.g. owasp top 10 | done | Guodong | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 052 | beancount loki logs | done | Guodong |  | 2025-10-09 | 2025-10-16 |
| 053 | [rollout] data backup | done |  | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 054 | Quick go to account | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 055 | responsiveness | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 056 | holdings download and CSV and query, etc. | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 057 | 🔥 build dashboard in [metrics.blockeden.xyz](http://metrics.blockeden.xyz/) - need to emit to metrics | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 058 | add a username field during sign up | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 059 | rename username | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 063 | collect and verify email during sign up | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 064 | collect first last name during sign up? | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 066 | fava and ledger's route path matching | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 067 | add shortcut for transaction https://fava.pythonanywhere.com/example-beancount-file/income_statement/#add-transaction | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 068 | add transaction https://fava.pythonanywhere.com/example-beancount-file/income_statement/#add-transaction | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 069 | syntax highlighting | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 070 | fava dashboard for /overview, need some user research | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 071 | beancount plugin / budget / forecast | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 072 | filter pills | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 073 | fix Transaction numbers are only allowed on a replica set member or mongos on  https://dashboard.v3.beancount.io/register | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 074 | export data by filter | done | Guodong |  | 2025-10-09 | 2025-10-16 |
| 075 | what is web-beancount/beancount-ledger/app/api/legacy.py | done |  |  | 2025-10-09 | 2025-10-16 |
| 076 | multi currency support | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 077 | do not hard code "USD" conversion | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 078 | journal price | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 079 | darkmode overview charts' texts | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 080 | /ledger/{ledgerOwner}/{ledgerName}/repo | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 081 | align amounts  (editor) | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 082 | toggle comments  (editor) | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 083 | open all folds   (editor) | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 084 | close all folds   (editor) | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 085 | git clone & push | done |  | beancount-v3 | 2025-09-22 | 2025-10-03 |
| 086 | update mongodb docker compose configuration | done |  | beancount-v3 | 2025-09-22 | 2025-10-03 |
| 087 | keyboard short cut like cmd+save | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 088 | how to manage git branches? ban main for now 🔥 | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 090 | I18n | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 092 | invite user should not leak email | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 094 | limit push file size | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 099 | remove all cuckoovpn metric code | done | Guodong |  | 2025-10-09 | 2025-10-16 |
| 103 | Unify all blog tags | done |  | beancount-v3.1 | 2025-10-07 | 2025-10-09 |
| 104 | use the accept-language's locale as detaul I18n | done |  | beancount-v3.1 | 2025-10-07 | 2025-10-09 |
| 106 | sign up email restrictions from gitea | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-10 |
| 110 | Simplify left menu | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 111 | Rename ledger not updating title | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 113 | 🔥Beancount mobile old version login | done |  |  | 2025-10-09 | 2025-10-16 |
| 115 | give a warning to user when create ledger | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 117 | guodong's claude code subscription upgrade | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 118 | Name must contain only alphabetic characters and numbers | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 119 | make add-directive more compact | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 120 | payment subscription / stripe and is paid | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 121 | publish all internal apis to [blockeden.xyz](http://blockeden.xyz/)'s internal api | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 122 | top bar filter by range | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 123 | we should block user to push to a new branch {"success":false,"error":"Invalid repository: Repository not found: puncsky/test4"} | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 124 | Renovate all emails | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 126 | PR for release | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 127 | initial loading state screen flashes / flickering | done | Guodong | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 128 | hide edit button at ledger list page when the user is not the owner of the legder | done | Guodong | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 129 | after joining a project, the colloborater cannot  leave it on their own. there is currently no way to do it | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 132 | show error for username's lowercase already exists when create new username or updating | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 133 | remove payment on iphone | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 134 | SEO headers | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 135 | [post-launch-feedback] net income value over the selected period | done |  | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 136 | [post-launch-feedback] CSV import(base on LLM) | done | Guodong | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 137 | [post-launch-feedback] journal entry payee and narration are both required - both are optional now | done |  | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 138 | [post-launch-feedback] add a new posting line default currency is usd again / should use default currency | done |  | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 139 | [post-launch-feedback] Ctrl + alt + [ / ] folds and unfolds text. This may be an issue in iso keyboard due to square brackets typing that already requires alt to be pressed. At least this is the case in my configuration and fold/unfold keyboard shortcut don’t work. | done | Tian | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 140 | [post-launch-feedback] forgot password email input has to unfocus and then submit | done |  | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 141 | [post-launch-feedback] forgot password email link not working | done |  | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 143 | auto import (PDF/ IMAGE/ CSV) PRAQ first | done | Guodong | beancount-v3.2 | 2025-10-20 | 2025-11-01 |
| 144 | daily routine  for posting https://raw.githubusercontent.com/stargately/web-beancount/refs/heads/main/beancount-cms/TODO.md | done |  | beancount | 2025-10-20 | 2025-11-15 |
| 145 | apply plaid api key | done |  | beancount | 2025-10-20 | 2025-11-15 |
| 147 | flatten i18n keys | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 148 | Swagger UI disabled in production （ledger-server dont export to outside） | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 155 | migrate database | done | Guodong | plaid poc | 2025-10-20 | 2025-11-15 |
| 157 | SSR for search engine | done | Tian | Open Ledger & Social Profiles | 2025-11-01 | 2025-12-01 |
| 158 | memory leak https://metrics.blockeden.xyz/d/beancount-backend/beancount-backend-metrics?orgId=1&from=now-7d&to=now&timezone=browser&refresh=30s | done |  |  | 2025-10-09 | 2025-10-16 |
| 161 | add import page dev view | done | Guodong | beancount | 2025-10-20 | 2025-11-15 |
| 162 | update metric to add more data panel | done |  | beancount | 2025-10-20 | 2025-11-15 |
| 163 | prepare credentials for new postgres-redis migration | done | Guodong | beancount | 2025-10-20 | 2025-11-15 |
| 166 | 🔥 I love the app but i am facing the following issues: 1) Earlier there was the editor, when i entered the editor it took me to the last transaction which was helpful if needed some modification. Now we have to scroll, and with thousands of transactions its impossible to scroll to the bottom in the touch phone. 2) if i try to edit a transaction lets say from journal, the form that opens is too big than my phone screen, and there is no way you can scroll or zoom out to make the required changes. The new update in ios need these basic changes please do so, looking forward to using the app Regards | done |  |  | 2025-10-09 | 2025-10-16 |
| 167 | https://beancount.io/api-gateway/sitemap.xml initalization time | done | Tian | beancount | 2025-10-20 | 2025-11-15 |
| 168 | https://beancount.io/ledger/open_ledger/example/overview double redirect | done | Tian |  | 2025-10-09 | 2025-10-16 |
| 169 | update tos and pp | done |  | monetization | 2025-10-09 | 2025-10-16 |
| 170 | context history for chat | done |  |  | 2025-10-09 | 2025-10-16 |
| 177 | claude code sandbox pin version | done |  |  | 2025-10-09 | 2025-10-16 |
| 178 | add https://beancount.io/ledger/healthz with ask-ai check | done |  |  | 2025-10-09 | 2025-10-16 |
| 180 | remove user all blocked status | done |  |  | 2025-10-09 | 2025-10-16 |

## Notes

Beancount project task tracker. Migrated from original project management table.
