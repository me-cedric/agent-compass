import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { detectPacks, detectStacks } from '../engine/detect.mjs'

test('detectStacks maps dependencies to stack ids', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-profiles-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({
      dependencies: { '@nestjs/core': '10', 'drizzle-orm': '0.30', bullmq: '5' },
      devDependencies: { turbo: '2' },
    }))
    assert.deepEqual(detectStacks(host), ['nestjs-api', 'drizzle-postgres', 'bullmq', 'turbo-monorepo'])

    await writeFile(join(host, 'package.json'), JSON.stringify({ dependencies: { expo: '51', 'react-native': '0.74', react: '18' } }))
    const mobile = detectStacks(host)
    assert.ok(mobile.includes('expo-mobile'))
    assert.ok(!mobile.includes('react-web'), 'react-native must not classify as react-web')

    await writeFile(join(host, 'package.json'), JSON.stringify({ dependencies: { '@angular/core': '20' } }))
    assert.deepEqual(detectStacks(host), ['angular-web'])

    await writeFile(join(host, 'package.json'), JSON.stringify({}))
    assert.deepEqual(detectStacks(host), [])

    await mkdir(join(host, '.specify'), { recursive: true })
    assert.deepEqual(detectStacks(host), ['spec-kit'])
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('detectStacks aggregates workspace packages, not just the monorepo root', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-profiles-mono-'))
  try {
    // Realistic turbo monorepo: root has only tooling deps; stacks live in apps/*.
    await writeFile(join(host, 'package.json'), JSON.stringify({ devDependencies: { turbo: '2' } }))
    await writeFile(join(host, 'turbo.json'), '{}')
    await mkdir(join(host, 'apps', 'api'), { recursive: true })
    await writeFile(join(host, 'apps', 'api', 'package.json'), JSON.stringify({
      dependencies: { '@nestjs/core': '10', '@nestjs/bullmq': '10', 'drizzle-orm': '0.30' },
    }))
    await mkdir(join(host, 'apps', 'web-app'), { recursive: true })
    await writeFile(join(host, 'apps', 'web-app', 'package.json'), JSON.stringify({
      dependencies: { react: '19', '@tanstack/react-router': '1' },
      // Must NOT classify as next-web: scoped plugin is not the next package.
      devDependencies: { '@next/eslint-plugin-next': '15' },
    }))
    const stacks = detectStacks(host)
    assert.deepEqual(stacks, ['nestjs-api', 'react-web', 'drizzle-postgres', 'bullmq', 'turbo-monorepo'])
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('detectStacks routes native, cross-platform and spec markers', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-detect-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ dependencies: { next: '15', react: '19' } }))
    assert.deepEqual(detectStacks(host), ['react-web', 'next-web'])

    await writeFile(join(host, 'package.json'), JSON.stringify({}))
    await writeFile(join(host, 'build.gradle.kts'), 'plugins { id("com.android.application") }')
    await mkdir(join(host, 'App.xcodeproj'))
    assert.deepEqual(detectStacks(host), ['android-compose', 'swift-ios'])

    await writeFile(join(host, 'package.json'), JSON.stringify({ dependencies: { expo: '55' } }))
    assert.deepEqual(detectStacks(host), ['expo-mobile'], 'expo owns the generated native trees')

    await writeFile(join(host, 'package.json'), JSON.stringify({}))
    await writeFile(join(host, 'pubspec.yaml'), 'dependencies:\n  flutter:\n    sdk: flutter\n')
    assert.deepEqual(detectStacks(host), [], 'flutter suppresses native markers')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('detectStacks finds an OpenSpec directory, not a file, and honours a declared path', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-detect-'))
  try {
    await writeFile(join(host, 'openspec'), 'not a directory')
    assert.deepEqual(detectStacks(host), [])
    await mkdir(join(host, 'specs-here', 'changes'), { recursive: true })
    assert.deepEqual(detectStacks(host, { openspecDir: 'specs-here' }), ['openspec'])
    await mkdir(join(host, 'docs', 'openspec'), { recursive: true })
    assert.deepEqual(detectStacks(host), ['openspec'])
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('detectStacks finds GTK, WinUI and macOS desktop apps', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-detect-desktop-'))
  try {
    await mkdir(join(host, 'apps/linux'), { recursive: true })
    await writeFile(join(host, 'apps/linux/Cargo.toml'), '[dependencies]\ngtk = { package = "gtk4", version = "0.10" }\nadw = { package = "libadwaita", version = "0.8" }\n')
    await mkdir(join(host, 'apps/windows'), { recursive: true })
    await writeFile(join(host, 'apps/windows/App.csproj'), '<Project><PropertyGroup><UseWinUI>true</UseWinUI></PropertyGroup></Project>\n')
    await mkdir(join(host, 'apps/mac/App.xcodeproj'), { recursive: true })
    await writeFile(join(host, 'apps/mac/App.xcodeproj/project.pbxproj'), 'SDKROOT = macosx;\n')
    assert.deepEqual(detectStacks(host), ['swift-ios', 'gtk-desktop', 'winui-desktop', 'macos-desktop'])

    await writeFile(join(host, 'apps/windows/App.csproj'), '<Project Sdk="Microsoft.NET.Sdk" />\n')
    await writeFile(join(host, 'apps/linux/Cargo.toml'), '[dependencies]\nserde = "1"\n')
    await writeFile(join(host, 'apps/mac/App.xcodeproj/project.pbxproj'), 'SDKROOT = iphoneos;\n')
    await writeFile(join(host, 'Package.swift'), 'platforms: [.macOS(.v13)], targets: [.executableTarget(name: "App")]\n')
    assert.deepEqual(detectStacks(host), ['swift-ios'], 'a Swift package that lists macOS can be a CLI or a server')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('detectPacks finds env templates, compose files and e2e suites in workspace packages', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-detect-packs-'))
  try {
    assert.deepEqual(detectPacks(host), [])
    await mkdir(join(host, 'apps/api'), { recursive: true })
    await writeFile(join(host, 'apps/api/.env.docker.example'), 'A=\n')
    assert.deepEqual(detectPacks(host), ['env'])
    await writeFile(join(host, 'apps/api/docker-compose.local.yml'), 'services: {}\n')
    await writeFile(join(host, 'apps/api/package.json'), JSON.stringify({ devDependencies: { '@playwright/test': '1' } }))
    assert.deepEqual(detectPacks(host), ['env', 'local-run', 'e2e'])
    const other = await mkdtemp(join(tmpdir(), 'ac-detect-packs-'))
    await writeFile(join(other, '.env.local'), 'A=1\n')
    await writeFile(join(other, 'process-compose.yaml'), 'version: "0.5"\n')
    await mkdir(join(other, '.maestro'))
    assert.deepEqual(detectPacks(other), ['local-run', 'e2e'], 'a local .env file is not a template')
    await writeFile(join(other, 'sonar-project.api.properties'), 'sonar.projectKey=a\n')
    assert.deepEqual(detectPacks(other), ['local-run', 'e2e', 'security'])
    await rm(other, { recursive: true, force: true })
    const osv = await mkdtemp(join(tmpdir(), 'ac-detect-packs-'))
    await writeFile(join(osv, '.osv-scanner.toml'), '')
    assert.deepEqual(detectPacks(osv), ['security'])
    await rm(osv, { recursive: true, force: true })
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
