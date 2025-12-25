import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const PageTransition = ({ children }) => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsVisible(true);
        prevPathRef.current = location.pathname;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  return (
    <div
      className="page-transition"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.15s ease-out',
      }}
    >
      {children}
    </div>
  );
};

export default PageTransition;
