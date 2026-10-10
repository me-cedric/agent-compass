---
id: declare-every-imported-module
trigger: 'when an Xcode target imports a module (Swift package product or framework) that its project file does not list as a dependency'
confidence: 0.8
domain: build
source: host-project-promotion
---

# A target declares every module it imports; autolink is not a dependency

## Action

List each module a target imports as a dependency of that target (in
`project.yml`, the Xcode project, or `Package.swift`). Do not rely on another
target or on autolink entries in object files to bring it in. After you add a
target that links a shared module, run one clean build of every target that
imports it.

## Why

An app imported a package module but did not declare it, and linked it only
through autolink. A new test target then linked the same module, and Xcode
built it as a dynamic framework. The app's objects compiled before that change
carried no `-framework` entry, an incremental build did not compile them again,
and the link failed with missing symbols. It looked like an architecture fault
and was not.
