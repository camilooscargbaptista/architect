# Architect Scanner Benchmark Report

This document contains the official scoring calibration against leading Open-Source projects.
The goal is to maintain False Positives (FP) < 5% and keep robust projects between 70-90 score.

## 🏆 Results Overview

| Project | Overall Score | Anti-patterns | Files Scanned | Lines Analyzed |
|---------|---------------|---------------|---------------|----------------|
| **nest** | **75/100** | 739 | 1917 | 151,896 |
| **express** | **79/100** | 26 | 142 | 21,587 |
| **axios** | **85/100** | 15 | 183 | 39,951 |
| **vite** | **96/100** | 425 | 1739 | 112,848 |

## 🔍 Deep Dive by Project

### NEST (Score: 75/100)

**Top Anti-Patterns Detected:**
- **God Class**: 12 occurrences
- **Circular Dependency**: 285 occurrences
- **Shotgun Surgery**: 392 occurrences
- **Feature Envy**: 50 occurrences

### EXPRESS (Score: 79/100)

**Top Anti-Patterns Detected:**
- **God Class**: 5 occurrences
- **Shotgun Surgery**: 14 occurrences
- **Feature Envy**: 7 occurrences

### AXIOS (Score: 85/100)

**Top Anti-Patterns Detected:**
- **God Class**: 3 occurrences
- **Shotgun Surgery**: 7 occurrences
- **Feature Envy**: 5 occurrences

### VITE (Score: 96/100)

**Top Anti-Patterns Detected:**
- **God Class**: 26 occurrences
- **Circular Dependency**: 172 occurrences
- **Shotgun Surgery**: 172 occurrences
- **Feature Envy**: 55 occurrences


## 🛠️ Calibration Notes
> If large OSS projects like *NestJS* or *Express* are dropping below 70, the `RulesEngine` is too aggressive. Metrics like *God Class* or *Circular Dependencies* need to recognize inversion of control or large utility files (like express router) gracefully without heavily penalizing the overall score.
