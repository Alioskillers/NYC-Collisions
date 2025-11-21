NYC Collisions Analytics Dashboard

Interactive analytics dashboard for exploring NYC motor vehicle collisions using a cleaned and sampled subset of the official NYC Open Data crashes & persons datasets.

The app focuses on exploratory data analysis (EDA): understanding when and where crashes happen, which vehicle types are involved, and how contributing factors and injuries are distributed.

⸻

Deployment Overview:

We have deployed our website on AWS EC2 through PM2 for backend to be running and NGINX for frontend reverse proxy, Using Amazon Linux 2023 as an OS and github to clone and pull changes from the repository, we used the region EU-North-1a (stockolm) because its the most stable region after the recent incident od US-East, for building the frontend the EC2 instance type is t3.micro so building the frontend will be too heavy so we built the app locally and sent the dist folder 

through scp command: 
scp -i ../collisions.pem -r dist ec2-user@ec2-16-170-67-112.eu-north-1.compute.amazonaws.com:/home/ec2-user/NYC-Collisions/frontend/dist,

For acceesing the instance we used SSH client by genrating a private access key called collisions.pem using RSA cryptographic secure algrithom.
please visit the link to access the website: http://16.170.67.112/

Tech Stack
	•	Frontend: React + Vite + Material UI + Plotly
	•	Backend: Node.js + Express
	•	Data Processing: Python / Pandas (offline, to create integrated CSV)
	•	Data Source: NYC Open Data – Motor Vehicle Collisions (Crashes + Persons), sampled to 10,000 rows

Main Features
	•	Analytics page with multiple interactive charts:
	•	Scatter: latitude vs hour
	•	Box plots by bodily injury
	•	Histogram of crash hour
	•	Bar chart of injury categories
	•	Monthly time-series line chart
	•	Correlation heatmap
	•	Pie chart of bodily injury share
	•	Filter toolbar (top of Analytics page):
	•	Filter by Borough, Year, Vehicle Type, Contributing Factor, Injury Type
	•	Global AND/OR logic toggle for combining filters
	•	“Generate Report” (apply filters) & “Reset” buttons
	•	Search bar (above the filters):
	•	Users can type queries like:
             brooklyn 2019 taxi crashes
        and the app automatically maps the words to filters.
	•	Backend filter API:
	•	Frontend builds a filter array and passes it to endpoints like /api/eda/*
	•	Backend returns Plotly-compatible JSON that the frontend wraps and renders safely

⸻

Dataset & Data Processing

We use an integrated CSV that merges crash-level info with person-level info:
	•	Columns include:
	•	CRASH DATE, CRASH TIME, CRASH_DATETIME
	•	BOROUGH, ZIP CODE, LATITUDE, LONGITUDE
	•	PERSON_TYPE, PERSON_INJURY, BODILY_INJURY
	•	VEHICLE TYPE CODE 1, VEHICLE TYPE CODE 2, …
	•	CONTRIBUTING FACTOR VEHICLE 1, CONTRIBUTING FACTOR VEHICLE 2, …

To keep the dashboard fast:
	•	We limit the integrated dataset to 10,000 rows (e.g., first 10k rows after cleaning).

Getting Started:

1. Prerequisites
	•	Node.js v18+ or v20+
	•	npm

2. Clone the Repository

3. Backend Setup

cd backend
npm install

4. Then build the frontend and install the dependencies:

cd frontend
npm install
npm run build

5. Run the server:

cd backend
node index.js


Using the Search Bar

The search bar lives above the filter toolbar on the Analytics page.
It parses your text and maps it to filters based on:
	•	Borough
	•	Year
	•	Vehicle Type
	•	Contributing Factor
	•	Injury Type

What it understands

Boroughs
Recognized (case-insensitive):
	•	brooklyn
	•	queens
	•	manhattan
	•	bronx
	•	staten island

Years
4-digit years present in the dataset, e.g.:
	•	2016
	•	2019
	•	2020

Vehicle type keywords
Matched by substrings like sedan, taxi, bike, etc.

Examples from our data:
	•	sedan
	•	station wagon
	•	suv (covers “Station Wagon/Sport Utility Vehicle”)
	•	taxi
	•	bike, bicyclist
	•	bus
	•	van
	•	truck (e.g., box truck, dump truck, tractor truck, concrete mixer)
	•	minibike
	•	limo

Contributing factor keywords
Examples that map to the factor filter (underlying columns like CONTRIBUTING FACTOR VEHICLE 1):
	•	Failure to Yield Right-of-Way
	•	Driver Inattention/Distraction
	•	Unsafe Lane Changing
	•	Following Too Closely
	•	Traffic Control Disregarded
	•	Passing or Lane Usage Improper
	•	Passing Too Closely
	•	Alcohol Involvement
	•	Other Vehicular
	•	Reaction to Uninvolved Vehicle
	•	Backing Unsafely
	•	Unsafe Speed
	•	Unspecified (less informative, but valid)

Injury / bodily injury keywords
From PERSON_INJURY and BODILY_INJURY:
	•	INJURED
	•	UNSPECIFIED
	•	Body/condition terms like:
	•	Head
	•	Back
	•	Chest
	•	Shoulder
	•	Knee
	•	Minor Bleeding
	•	Internal
	•	Complaint of Pain or Nausea
	•	None Visible

⸻

Example queries you can type

All of these should give meaningful data with the current parser:

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

Vehicle type + factor
	•	taxi driver inattention
	•	bike passing or lane usage improper
	•	suv following too closely
	•	bus backing unsafely

Injury-focused
	•	head injuries brooklyn 2019
	•	back injuries queens 2019
	•	minor bleeding manhattan
	•	complaint of pain or nausea brooklyn
	•	internal injuries 2019

Mode + borough + year
	•	pedestrian injured brooklyn 2019
	•	bicyclist injured queens 2019
	•	bike injured manhattan 2019

The search bar converts these into structured filters and then triggers the same analytics calls as the manual filter toolbar.

👥 Team & Contributions
	•	Ali Ahmed – Website implementation (backend & integration)
	•	Ali Mohab – Website implementation (frontend & integration)
	•	Eiad Hamdy – Persons and Craches datasets initial Data cleaning and EDA.
	•	Marwan Samir – Data cleaning, handling missing values and inconsistent formats and handling outliers.
	•	Loay Waleed – Post Integration and joining the 2 datasets and preforming Post Integration Data cleaning, EDA creating the integrated CSV used by the dashboard.