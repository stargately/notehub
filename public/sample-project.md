---
project: Beancount Project Management
created: 2025-09-22
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
    type: select
  - field: created
    width: 110
    type: date
  - field: done
    width: 110
    type: date
milestone_options:
  - beancount-v3
  - beancount-v3.1
  - beancount-v3.2
  - beancount
  - monetization
  - plaid poc
  - AI-Powered Accounting
  - Open Ledger & Social Profiles
  - Github integration
  - simplify ui
status_options:
  - todo
  - done
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
| 001 | use gemini to translate - founder resources hub and new blogs | done |  |  | 2025-09-22 | 2025-10-09 |
| 002 | auto deploy by git push | done | Tian | beancount-v3 | 2025-10-02 | 2025-10-09 |
| 003 | deploy https://blockeden.xyz/dash/ws_iyUG9p5zQHM3E7VDnBQn/projects/srv-web-beancount | done | Tian | beancount-v3 | 2025-10-02 | 2025-10-09 |
| 004 | [rollout] dashboard should support webview login | done |  | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 005 | build dashboard in metrics.blockeden.xyz - endpoint is prepared | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 006 | holiday calendar | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-10 |
| 007 | test coverage for all services | done | Guodong | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 008 | polish mobile UI styles and publish new versions | done |  |  | 2025-09-22 | 2025-10-09 |
| 009 | discourse forum v1 | done |  |  | 2025-09-22 | 2025-10-09 |
| 010 | add vmiss to backstage | done | Guodong |  | 2025-10-16 | 2025-10-16 |
| 011 | update Beancount migration guide | done | Guodong | beancount-v3 | 2025-09-24 | 2025-10-09 |
| 012 | beancount-mobile release is broken after bumping expo | done | Tian |  | 2025-09-22 | 2025-10-09 |
| 013 | forum login problem | done | Tian |  | 2025-09-22 | 2025-10-09 |
| 014 | Completed the development of the ledger-server API | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-03 |
| 015 | complete web dashboard feature | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-10 |
| 016 | Adapted and fixed mobile compatibility | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-14 |
| 017 | support testnet env | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-10 |
| 018 | buy github copilot and claude code | done | Guodong | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 019 | ledger sharing | done | Guodong | beancount-v3 | 2025-10-09 | 2025-10-16 |
| 020 | load production data into dashboard.v3.beancount.io | done | Tian | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 021 | added initial beancount metrics - beancount backend | done | Guodong | beancount-v3 | 2025-09-22 | 2025-10-10 |
| 022 | SEO headers for beancount.io/ledger/open_ledger/example | done |  | beancount | 2025-10-20 | 2025-11-15 |
| 023 | update database primary key to make it more semantic | done | Guodong | beancount | 2025-10-20 | 2025-11-15 |
| 024 | ledger options | done | Tian | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 025 | proof of concept for beancount ai | done | Tian | beancount-v3.1 | 2025-09-22 | 2025-10-09 |
| 026 | document all cloud hosting usage in backstage | done |  |  | 2025-10-09 | 2025-10-13 |
| 027 | polish mobile UI styles | done |  |  | 2025-09-22 | 2025-10-09 |
| 028 | internal API dashboard / onboard swagger openapi | done | Tian |  | 2025-10-09 | 2025-10-13 |
| 029 | load testing and capacity planning for git-based project | done | Guodong |  | 2025-09-22 | 2025-10-09 |
| 030 | add /openapi.json to services | done |  |  | 2025-10-09 | 2025-10-13 |
| 031 | bug fixes & feature parity & documentation | done |  |  | 2025-10-09 | 2025-10-13 |
| 032 | pricing tiers and payment wall | done | Tian | monetization | 2025-10-09 | 2025-10-16 |
| 033 | migrate off mailgun | done |  |  | 2025-10-09 | 2025-10-16 |
| 034 | update pricing plans | done | Tian | monetization | 2025-10-09 | 2025-10-16 |
| 035 | investigate how to sync | done | Guodong | plaid poc | 2025-10-20 | 2025-11-15 |
| 036 | sqlite vs postgresql for gitea - choose postgresql | done |  | beancount-v3 | 2025-09-22 | 2025-10-03 |
| 037 | Backend vs backend v2 | done |  | beancount-v3 | 2025-09-22 | 2025-10-03 |
| 038 | not found error for private repo in dashboard | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 039 | migrate off mailgun (2) | done |  |  | 2025-10-09 | 2025-10-16 |
| 040 | data loaders: v2-mongodb-to-v3 and v3 mongodb+ cronjob | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 041 | [rollout] login as paid user and test v3 experience | done |  | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 042 | [rollout] mobile fava | done |  | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 043 | [rollout] pricing plans details | done | Tian | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 044 | design for overview | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 045 | make content more compact in income statement | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-13 |
| 046 | income_statement conversion and interval support | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 047 | income_statement more kinds of charts | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 048 | [rollout] rollout plan - feature parity comparison | done | Tian | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 049 | trial balance | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 050 | journal attributes of table and order | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 051 | [rollout] security review e.g. owasp top 10 | done | Guodong | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 052 | beancount loki logs | done | Guodong |  | 2025-10-09 | 2025-10-16 |
| 053 | [rollout] data backup | done |  | beancount-v3 | 2025-10-09 | 2025-10-13 |
| 054 | Quick go to account | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 055 | responsiveness | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 056 | holdings download and CSV and query etc. | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 057 | build dashboard in metrics.blockeden.xyz - emit to metrics | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 058 | add a username field during sign up | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 059 | rename username | done | Guodong | beancount-v3 | 2025-10-13 | 2025-10-16 |
| 060 | AI CFO to write / create PR | todo | Tian | AI-Powered Accounting |  |  |
| 061 | unblock all users | todo |  |  |  |  |
| 062 | update auto-importer landing pages | todo | Guodong | beancount |  |  |
| 063 | collect and verify email during sign up | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 064 | collect first last name during sign up | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 065 | connect to plaid launch prep and blog announcement | todo | Guodong | beancount |  |  |
| 066 | fava and ledger route path matching | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 067 | add shortcut for transaction | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 068 | add transaction form | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 069 | syntax highlighting | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 070 | fava dashboard for overview with user research | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 071 | beancount plugin / budget / forecast | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 072 | filter pills | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 073 | fix Transaction numbers replica set error on register | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 074 | export data by filter | done | Guodong |  | 2025-10-09 | 2025-10-16 |
| 075 | what is web-beancount/beancount-ledger/app/api/legacy.py | done |  |  | 2025-10-09 | 2025-10-16 |
| 076 | multi currency support | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 077 | do not hard code USD conversion | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 078 | journal price | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 079 | darkmode overview charts texts | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 080 | /ledger/{ledgerOwner}/{ledgerName}/repo | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 081 | align amounts (editor) | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 082 | toggle comments (editor) | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 083 | open all folds (editor) | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 084 | close all folds (editor) | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 085 | git clone & push | done |  | beancount-v3 | 2025-09-22 | 2025-10-03 |
| 086 | update mongodb docker compose configuration | done |  | beancount-v3 | 2025-09-22 | 2025-10-03 |
| 087 | keyboard shortcut like cmd+save | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 088 | how to manage git branches? ban main for now | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 089 | update documentation for mature features | todo | Guodong | beancount-v3.1 |  |  |
| 090 | I18n | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 091 | account settings to import data (mobile) | todo | Tian | beancount-v3.1 |  |  |
| 092 | invite user should not leak email | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 093 | auto show README.md | todo |  | Open Ledger & Social Profiles |  |  |
| 094 | limit push file size | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 095 | crypto - domain specific beancount setup example | todo |  | Open Ledger & Social Profiles |  |  |
| 096 | real estate - domain specific beancount setup example | todo |  | Open Ledger & Social Profiles |  |  |
| 097 | simplify ui | todo | Tian | simplify ui |  |  |
| 098 | redesign og:image for beancount.io | todo |  |  |  |  |
| 099 | manage swagger file exposure in production | todo |  |  |  |  |
| 100 | remove all cuckoovpn metric code | done | Guodong |  | 2025-10-09 | 2025-10-16 |
| 101 | tanstack start investigation ssr | todo | Guodong |  |  |  |
| 102 | logger review | todo |  | beancount |  |  |
| 103 | metabase connection | todo |  | beancount |  |  |
| 104 | Unify all blog tags | done |  | beancount-v3.1 | 2025-10-07 | 2025-10-09 |
| 105 | use accept-language locale as default I18n | done |  | beancount-v3.1 | 2025-10-07 | 2025-10-09 |
| 106 | update welcome email | todo |  | beancount |  |  |
| 107 | sign up email restrictions from gitea | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-10 |
| 108 | backend-v2 add forum sso | todo |  | beancount-v3 |  |  |
| 109 | query string to filter prefill | todo |  | beancount-v3 |  |  |
| 110 | customize query to sidebar | todo |  | beancount-v3.? |  |  |
| 111 | Simplify left menu | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 112 | Rename ledger not updating title | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 113 | use cloudflare turnstile to prevent bot attack | todo |  | beancount-v3.? |  |  |
| 114 | Beancount mobile old version login | done |  |  | 2025-10-09 | 2025-10-16 |
| 115 | ads for free user | todo | Guodong | beancount-v3.1 |  |  |
| 116 | give a warning to user when create ledger | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 117 | Beancount-mobile GitHub copywriting | todo |  | beancount-v3.1 |  |  |
| 118 | guodong's claude code subscription upgrade | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 119 | Name must contain only alphabetic chars and numbers | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 120 | make add-directive more compact | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 121 | payment subscription / stripe and is paid | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 122 | publish all internal apis to blockeden.xyz | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 123 | top bar filter by range | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 124 | block user to push to a new branch | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 125 | Renovate all emails | done | Tian | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 126 | invite user to register and share ledger | todo |  | beancount-v3.1 |  |  |
| 127 | PR for release | done | Guodong | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 128 | initial loading state screen flashes / flickering | done | Guodong | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 129 | hide edit button when user is not owner | done | Guodong | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 130 | collaborator cannot leave project on their own | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 131 | build agent native organization | todo |  | beancount-v3.1 |  |  |
| 132 | feedback collector widget | todo |  | beancount-v3.1 |  |  |
| 133 | show error for username lowercase already exists | done |  | beancount-v3 | 2025-09-26 | 2025-10-13 |
| 134 | remove payment on iphone | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 135 | SEO headers | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 136 | [post-launch] net income value over selected period | done |  | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 137 | [post-launch] CSV import based on LLM | done | Guodong | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 138 | [post-launch] journal payee and narration both optional | done |  | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 139 | [post-launch] new posting default currency should use default | done |  | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 140 | [post-launch] fold/unfold keyboard shortcut iso keyboard fix | done | Tian | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 141 | [post-launch] forgot password email unfocus then submit | done |  | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 142 | [post-launch] forgot password email link not working | done |  | beancount-v3 | 2025-10-16 | 2025-10-20 |
| 143 | Zero down time deploy | todo |  | beancount-v3.1 |  |  |
| 144 | auto import (PDF/IMAGE/CSV) PRFAQ first | done | Guodong | beancount-v3.2 | 2025-10-20 | 2025-11-01 |
| 145 | daily routine for posting TODO.md | done |  | beancount | 2025-10-20 | 2025-11-15 |
| 146 | apply plaid api key | done |  | beancount | 2025-10-20 | 2025-11-15 |
| 147 | Monaco editor bad on mobile | todo |  | beancount-v3.1 |  |  |
| 148 | flatten i18n keys | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 149 | Swagger UI disabled in production | done |  | beancount-v3.1 | 2025-10-13 | 2025-10-20 |
| 150 | editor experience | todo |  | beancount-v3.1 |  |  |
| 151 | deprecate sign-in and sign-up REST API | todo |  | beancount-v3.1 |  |  |
| 152 | Email i18n | todo |  | beancount-v3.1 |  |  |
| 153 | Debug mode disabled | todo |  | beancount-v3.1 |  |  |
| 154 | integrate with github for deploy PR and contribute | todo |  | Github integration |  |  |
| 155 | user's invoice persistence | todo |  |  |  |  |
| 156 | migrate database | done | Guodong | plaid poc | 2025-10-20 | 2025-11-15 |
| 157 | how to segregate internal apis from public access | todo |  |  |  |  |
| 158 | SSR for search engine | done | Tian | Open Ledger & Social Profiles | 2025-11-01 | 2025-12-01 |
| 159 | memory leak metrics.blockeden.xyz | done |  |  | 2025-10-09 | 2025-10-16 |
| 160 | Surface forum discussions | todo |  |  |  |  |
| 161 | add import page dev view | done | Guodong | beancount | 2025-10-20 | 2025-11-15 |
| 162 | update metric to add more data panel | done |  | beancount | 2025-10-20 | 2025-11-15 |
| 163 | prepare credentials for new postgres-redis migration | done | Guodong | beancount | 2025-10-20 | 2025-11-15 |
| 164 | migrate translate to use TranslateGemma | todo |  |  |  |  |
| 165 | learn growth from befreed.ai | todo |  |  |  |  |
| 166 | mobile UI scrolling and edit form too big issues | done |  |  | 2025-10-09 | 2025-10-16 |
| 167 | beancount.io/api-gateway/sitemap.xml initialization time | done | Tian | beancount | 2025-10-20 | 2025-11-15 |
| 168 | beancount.io open_ledger double redirect | done | Tian |  | 2025-10-09 | 2025-10-16 |
| 169 | update tos and pp | done |  | monetization | 2025-10-09 | 2025-10-16 |
| 170 | context history for chat | done |  |  | 2025-10-09 | 2025-10-16 |
| 171 | account operations / manage | todo | Guodong | beancount-v3.1 |  |  |
| 172 | PRFAQ tax prep tools | todo |  |  |  |  |
| 173 | Android app 16kb memory page sizes | todo |  |  |  |  |
| 174 | google analytics mcp | todo |  |  |  |  |
| 175 | claude code sandbox pin version | done |  |  | 2025-10-09 | 2025-10-16 |
| 176 | add beancount.io/ledger/healthz with ask-ai check | done |  |  | 2025-10-09 | 2025-10-16 |
| 177 | update to new admin token 36k27 | todo |  |  |  |  |
| 178 | remove user all blocked status | done |  |  | 2025-10-09 | 2025-10-16 |
| 179 | dashboard performance | todo | Guodong | beancount-v3.1 |  |  |
| 180 | mobile | todo |  |  |  |  |

## Notes

Beancount project task tracker. Migrated from original project management table.
