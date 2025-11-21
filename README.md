# 🚗 NYC Collisions Analytics Dashboard

An interactive analytics dashboard for exploring NYC motor vehicle collisions using a cleaned and sampled subset of the official NYC Open Data **Crashes** and **Persons** datasets.

The dashboard focuses on **Exploratory Data Analysis (EDA)**:  
- When and where crashes occur  
- Which vehicle types are involved  
- How contributing factors vary  
- How injuries are distributed

Borough + year
	•	brooklyn 2019 crashes
	•	queens 2020 collisions
	•	manhattan 2016

Borough + year + vehicle type
	•	brooklyn 2019 sedan crashes
	•	queens 2019 suv collisions
	•	bronx 2019 taxi crashes
	•	manhattan 2019 bike crashes
	•	staten island 2019 bus crashes

Borough + contributing factor
	•	queens driver inattention
	•	brooklyn failure to yield
	•	manhattan unsafe lane changing
	•	bronx following too closely

Borough + year + factor
	•	brooklyn 2019 driver inattention
	•	queens 2019 failure to yield
	•	manhattan 2019 alcohol involvement

Research Questions

This dashboard is designed to support a variety of data-driven research questions, such as:
	1.	Which borough has the highest crash rate per capital?
	2.	How do total crash counts change over time (year-over-year and month-by-month)?
	3.	Which borough experiences the highest number of severe or injury-related crashes?
	4.	Which vehicle types (e.g., taxi, SUV, bike) are most frequently involved in collisions?
	5.	What are the most common contributing factors for crashes in each borough?
	6.	At what hours of the day do crashes peak, and does this pattern differ by borough?
	7.	Are certain vehicle types more likely to be involved in crashes during nighttime hours?
	8.	Which contributing factors are most associated with crashes resulting in bodily injuries (vs. property damage only)?
	9.	Which injury types (e.g., head injuries, internal injuries) appear most frequently across different boroughs or vehicle types?
	10.	Are there noticeable temporal shifts (e.g., before/after a given year) in specific contributing factors such as driver inattention or failure to yield?

> **Note**  
> The original datasets are very large. We limit the integrated dataset to **10,000 rows** to keep backend loading and frontend rendering fast and stable.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Deployment Overview](#deployment-overview)
- [Tech Stack](#tech-stack)
- [Main Features](#main-features)
- [Dataset & Data Processing](#dataset--data-processing)
- [Getting Started](#getting-started)
- [Using the Search Bar](#using-the-search-bar)
- [What the Search Bar Understands](#what-the-search-bar-understands)
- [Example Queries](#example-queries)
- [Team & Contributions](#team--contributions)

---

## Overview

The **NYC Collisions Analytics Dashboard** visualizes multiple aspects of motor vehicle collisions in New York City:

- Temporal patterns (hour of day, month, year)
- Injury distributions and severities
- Vehicle type involvement
- Contributing factors to collisions
- Spatial behavior via latitude-based scatter plots

The backend exposes clean `/api/eda/*` endpoints that return **Plotly-compatible JSON**, while the frontend renders interactive charts and provides an intelligent search and filtering experience.

---

## Deployment Overview

The project is deployed on **AWS EC2** with a production-style setup.

### 🖥️ Infrastructure

- **OS:** Amazon Linux 2023  
- **Region:** `eu-north-1a` (Stockholm) — chosen for stability after recent incidents in `us-east`  
- **Instance Type:** `t3.micro` (frontend build done locally to avoid heavy build on the instance)

### 🔧 Backend

- Runs on **Node.js + Express**
- Managed using **PM2** for process management
- Integrated dataset file (`Integrated.csv`) is:
  - Uploaded to an **S3 bucket**
  - Copied from S3 to the EC2 instance to reduce latency and avoid downloading a huge file at runtime

### 🌐 Frontend

Because `t3.micro` is small for local builds on the instance, the frontend is built **locally** and then deployed to the server:

```bash
# From local machine – build frontend
cd frontend
npm install
npm run build

# Copy built assets to EC2 via SCP
scp -i ../collisions.pem -r dist \
  ec2-user@ec2-16-170-67-112.eu-north-1.compute.amazonaws.com:/home/ec2-user/NYC-Collisions/frontend/dist