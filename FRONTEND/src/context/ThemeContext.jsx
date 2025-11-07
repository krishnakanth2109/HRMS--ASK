import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // pehle localStorage se check karenge, warna default blue
  const [themeColor, setThemeColorState] = useState(
    localStorage.getItem("themeColor") || "#3B82F6"
  );

  // function to update both state, CSS variable, and localStorage
  const setThemeColor = (color) => {
    setThemeColorState(color);
    localStorage.setItem("themeColor", color); // ✅ store in localStorage
    document.documentElement.style.setProperty("--main-bg-color", color);
    document.documentElement.style.setProperty("--primary-color", color);
  };

  // initialize CSS variable on first load (from state/localStorage)
  useEffect(() => {
    document.documentElement.style.setProperty("--main-bg-color", themeColor);
    document.documentElement.style.setProperty("--primary-color", themeColor);
  }, [themeColor]);

  return (
    <ThemeContext.Provider value={{ themeColor, setThemeColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

// custom hook
export const useTheme = () => useContext(ThemeContext);
