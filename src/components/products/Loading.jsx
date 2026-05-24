import React from "react";

const LoadingModal = ({ isOpen = false, text = "Loading..." }) => {
  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.spinner}></div>
        <p style={styles.text}>{text}</p>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modal: {
    backgroundColor: "#fff",
    padding: "20px 30px",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #e5e7eb",
    borderTop: "4px solid #3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  text: {
    marginTop: "10px",
    fontSize: "14px",
    color: "#333",
  },
};

// inject keyframes (important)
const styleSheet = document.styleSheets[0];
const keyframes = `
@keyframes spin {
  0% { transform: rotate(0deg);}
  100% { transform: rotate(360deg);}
}`;
if (styleSheet) {
  styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
}

export default LoadingModal;