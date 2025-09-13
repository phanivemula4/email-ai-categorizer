import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DOMPurify from 'dompurify';
import './App.css';

// --- A helper function to prevent API calls on every keystroke ---
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
}

// --- Type definition for our Email object ---
interface Email {
  uid: number;
  from: string;
  subject: string;
  date: string;
  body: string;
  category: string;
}

// --- Main App Component ---
function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- API fetching logic ---
  const fetchAndSetEmails = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = query 
        ? `http://localhost:5555/search?q=${query}` 
        : 'http://localhost:5555/emails';

      const response = await axios.get(endpoint);
      setEmails(response.data);
    } catch (err) {
      setError('Failed to fetch emails. Make sure all services are running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(debounce(fetchAndSetEmails, 300), []);

  // Single useEffect for initial + search
  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      fetchAndSetEmails('');
    }
  }, [searchQuery, debouncedSearch]);

  // Helper functions for display
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString();

  const getCategoryClass = (category: string) =>
    `label-${category.replace(' ', '_')}`;

  return (
    <>
      <div className="container">
        <header>
          <h1>AI Email Categorizer</h1>
        </header>

        <div className="search-container">
          <input
            type="text"
            placeholder="Search emails..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <main>
          {loading && <div className="spinner"></div>}
          {error && <p className="status-message">{error}</p>}
          {!loading && !error && (
            <ul className="email-list">
              {emails.length > 0 ? (
                emails.map(email => (
                  <li
                    key={email.uid}
                    className="email-item"
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="email-header">
                      <span className="email-sender">{email.from}</span>
                      <span className="email-date">
                        {formatDate(email.date)}
                      </span>
                    </div>
                    <div className="email-subject">
                      <span
                        className={`category-label ${getCategoryClass(
                          email.category
                        )}`}
                      >
                        {email.category}
                      </span>
                      {email.subject}
                    </div>
                    <p className="email-body">
                      {email.body
                        .replace(/<[^>]*>?/gm, '')
                        .substring(0, 150)}
                    </p>
                  </li>
                ))
              ) : (
                <p className="status-message">No emails found.</p>
              )}
            </ul>
          )}
        </main>
      </div>

      {/* --- Email Detail Modal --- */}
      {selectedEmail && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedEmail(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{selectedEmail.subject}</h2>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedEmail(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-subheader">
              <strong>From:</strong> {selectedEmail.from}
              <br />
              <strong>Date:</strong> {formatDate(selectedEmail.date)}
            </div>
            <div
              className="modal-body"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(selectedEmail.body),
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default App;
