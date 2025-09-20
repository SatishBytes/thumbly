import React from "react";

const aboutSections = [
  {
    title: "Purpose & Vision",
    content: (
      <>
        <p>
          <strong>GenThumbAI</strong> empowers creators, marketers, and developers to generate stunning, AI-powered thumbnails in seconds. Our vision is to make high-quality, engaging visuals accessible to everyone—no design skills required.
        </p>
      </>
    ),
  },
  {
    title: "How It Works",
    content: (
      <ol style={{ paddingLeft: 20 }}>
        <li>Upload your image or screenshot.</li>
        <li>Optionally, enter a prompt to guide the AI for a unique thumbnail.</li>
        <li>Let our AI generate and enhance your thumbnail—ready to use instantly!</li>
      </ol>
    ),
  },
  {
    title: "Tech Stack & Auth",
    content: (
      <ul style={{ paddingLeft: 20 }}>
        <li>Frontend: React, TypeScript, Framer Motion</li>
        <li>Backend: Node.js, Express, Google Gemini AI</li>
        <li>Authentication: Clerk</li>
        <li>Storage: Cloud storage (S3 or compatible)</li>
      </ul>
    ),
  },
  {
    title: "Meet the Maker",
    content: (
      <blockquote style={{ borderLeft: "4px solid #0070f3", margin: "1rem 0", paddingLeft: 16, color: "#374151" }}>
        Built by <strong>Satish</strong>, a hands-on architect passionate about scalable AI-powered web apps.
      </blockquote>
    ),
  },
  {
    title: "Roadmap",
    content: (
      <ul style={{ paddingLeft: 20 }}>
        <li>Batch uploads <span style={{ color: "#10b981" }}>coming soon</span></li>
        <li>Theme toggles</li>
        <li>Prompt history</li>
      </ul>
    ),
  },
  {
    title: "Contact / Feedback",
    content: (
      <p>
        Found a bug or have a feature idea?{" "}
        <a href="mailto:satish@example.com" style={{ color: "#0070f3", textDecoration: "underline" }}>
          Drop a message!
        </a>
      </p>
    ),
  },
];

export default function About() {
  return (
    <div
      style={{
        maxWidth: 700,
        margin: "0 auto",
        padding: "2.5rem 1.5rem",
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.09)",
        marginTop: 40,
        marginBottom: 40,
      }}
    >
      <h1 style={{ fontSize: "2.2rem", fontWeight: 700, marginBottom: 18, color: "#0070f3" }}>
        About GenThumbAI
      </h1>
      {aboutSections.map((section) => (
        <section key={section.title} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>{section.title}</h2>
          <div style={{ fontSize: "1.05rem", color: "#374151" }}>{section.content}</div>
        </section>
      ))}
    </div>
  );
}