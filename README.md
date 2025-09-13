# AI Email Categorizer

This is a full-stack application that automatically fetches emails from a Gmail account, categorizes them using the Google Gemini AI into predefined labels, and displays them in a searchable web interface built with React.



## ✨ Features

* *Automatic AI Categorization*: Fetches emails from the last 30 days and uses Google Gemini to classify them into categories like "Interested," "Meeting Booked," "Spam," etc.
* *Efficient Processing*: Caches categorized emails in an Elasticsearch database to avoid re-processing old emails, saving API quota.
* *Powerful Search*: Instantly search through all categorized emails by sender, subject, or content.
* *Clean Web Interface*: A simple and responsive UI built with React and Vite to view and read emails.
* *Full Email View*: Click on any email to open a modal and view its full, sanitized HTML content.

## 🛠 Tech Stack

* *Backend*: Node.js, Express, TypeScript
* *Frontend*: React, Vite, TypeScript
* *Database*: Elasticsearch (run via Docker)
* *AI Service*: Google Gemini API
* *Email Fetching*: IMAP (for Gmail)

---

## 🚀 Getting Started

Follow these instructions to get the project running on your local machine.

### Prerequisites

* *Node.js*: Make sure you have Node.js installed (v18 or higher).
* *Docker*: Make sure you have Docker Desktop installed and running.

### 1. Clone the Repositories

Clone both the frontend and backend repositories to your local machine.

bash
git clone <your-backend-repo-url>
git clone <your-frontend-repo-url>


### 2. Backend Setup

1.  *Navigate to the backend project directory:*
    bash
    cd <your-backend-folder-name>
    

2.  *Install dependencies:*
    bash
    npm install
    

3.  *Create the Environment File:* Create a file named .env in the root of your backend project and add the following variables.

    env
    # .env file for the backend

    # Your Gmail address
    IMAP_USER="your-email@gmail.com"

    # Your 16-digit Google App Password for Gmail
    IMAP_PASS="xxxxxxxxxxxxxxxx"

    # Your API key from the Google AI Studio
    GOOGLE_API_KEY="your-google-gemini-api-key"
    

### 3. Frontend Setup

1.  *Navigate to the frontend project directory:*
    bash
    cd <your-frontend-folder-name>
    

2.  *Install dependencies:*
    bash
    npm install
    

---

## ▶ Running the Application

You will need to have *3 separate terminals* open to run the entire application.

### Terminal 1: Start the Database

Start the Elasticsearch container using Docker.
bash
docker run -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:8.9.2

*Important*: Wait about 60 seconds for it to fully initialize. You can verify it's ready by visiting http://localhost:9200 in your browser. You should see a JSON response.

### Terminal 2: Start the Backend Server

Once the database is ready, navigate to your backend folder and run:
bash
npm run dev

The server will start on http://localhost:5555.

### Terminal 3: Start the Frontend Application

Finally, navigate to your frontend folder and run:
bash
npm run dev

The React application will open in your browser, usually at http://localhost:5173.
