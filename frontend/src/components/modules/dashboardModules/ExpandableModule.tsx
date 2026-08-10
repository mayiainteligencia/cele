import React, { useState } from 'react';

interface ExpandableModuleProps {
  children: React.ReactNode;
  expandDirection: 'left' | 'right';
}

export const ExpandableModule: React.FC<ExpandableModuleProps> = ({ 
  children, 
  expandDirection 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      style={{
        position: 'relative',
        transform: isExpanded 
          ? expandDirection === 'right' 
            ? 'scale(1.25) translateX(10%)' 
            : 'scale(1.25) translateX(-10%)'
          : 'scale(1) translateX(0)',
        transformOrigin: expandDirection === 'right' ? 'left center' : 'right center',
        transition: 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.5s ease, z-index 0s',
        zIndex: isExpanded ? 100 : 1,
        filter: isExpanded ? 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3))' : 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))',
        willChange: 'transform, filter',
      }}
    >
      {children}
    </div>
  );
};