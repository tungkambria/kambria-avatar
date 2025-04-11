import React, { createContext, useState, useMemo, useEffect } from "react";

// Translation data
const translations = {
  en: {
    title: "Facebook Profile Picture Builder",
    uploadProfile: "Upload Profile Picture",
    uploadFrame: "Upload Frame (PNG with transparency)",
    instructions: "Instructions:",
    desktopInstructions:
      "Desktop: Drag to move, scroll to zoom, arrow keys to adjust position, +/- to zoom.",
    mobileInstructions: "Mobile: Tap and drag to move, pinch to zoom.",
    reset: "Reset",
    undo: "Undo",
    download: "Download Profile Picture",
    scale: "Scale",
    position: "Position",
    selectFrame: "Select Frame",
  },
  vi: {
    title: "Trình tạo ảnh đại diện Facebook",
    uploadProfile: "Tải lên ảnh đại diện",
    uploadFrame: "Tải lên khung (PNG có độ trong suốt)",
    instructions: "Hướng dẫn:",
    desktopInstructions:
      "Máy tính: Kéo để di chuyển, cuộn để phóng to/thu nhỏ, phím mũi tên để điều chỉnh vị trí, +/- để phóng to/thu nhỏ.",
    mobileInstructions:
      "Di động: Chạm và kéo để di chuyển, chụm để phóng to/thu nhỏ.",
    reset: "Đặt lại",
    undo: "Hoàn tác",
    download: "Tải ảnh đại diện",
    scale: "Tỷ lệ",
    position: "Vị trí",
    selectFrame: "Chọn khung",
  },
};

// Create context
export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  // Initialize language from localStorage or default to 'en'
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem("language");
    return savedLanguage && translations[savedLanguage] ? savedLanguage : "vi";
  });

  // Save language to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key) => translations[language][key] || key, // Translation function
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
