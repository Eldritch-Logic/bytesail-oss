---
title: Environments
description: Working with environments
---

Each project has one or more environments (e.g., Production, Staging). Environments scope variables and deployments so you can run the same services with different configurations.

## Default Environment

Every project starts with a **Production** environment created automatically. This is the environment used for all deployments unless you specify otherwise.

## How Environments Work

- Each environment has its own set of **variables** stored as Kubernetes Secrets
- Deployments target a specific environment
- Domains are associated with an environment
- When you deploy, ByteSail syncs the environment's variables to a K8s Secret named `<service-slug>-env` in the project namespace
