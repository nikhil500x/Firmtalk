'use client';
import { useState, useRef, useEffect } from 'react';
import { MoreVertical, LucideIcon } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

interface MoreActionsMenuProps {
  items: MenuItem[];
  label?: string;
  buttonClassName?: string;
}

export default function MoreActionsMenu({ 
  items, 
  label = 'More actions',
  buttonClassName = ''
}: MoreActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, openUpward: false });
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Calculate menu position when opened
  useEffect(() => {
    if (open && buttonRef.current) {
      const calculatePosition = () => {
        if (!buttonRef.current) return;
        
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const menuHeight = items.length * 40 + 16; // Approximate height
        const menuWidth = 192; // w-48 = 12rem = 192px
        
        const spaceBelow = window.innerHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;
        const spaceRight = window.innerWidth - buttonRect.right;
        
        const margin = 8;
        const openUpward = spaceBelow < menuHeight + margin && spaceAbove > menuHeight + margin;
        
        let top: number;
        let left: number;
        
        if (openUpward) {
          top = buttonRect.top - menuHeight - margin;
        } else {
          top = buttonRect.bottom + margin;
        }
        
        // Position from the right edge of the button
        if (spaceRight < menuWidth) {
          // Not enough space on right, align to right edge of button
          left = buttonRect.right - menuWidth;
        } else {
          // Enough space, align to right edge of button
          left = buttonRect.right - menuWidth;
        }
        
        // Ensure menu doesn't go off-screen
        if (left < margin) left = margin;
        if (left + menuWidth > window.innerWidth - margin) {
          left = window.innerWidth - menuWidth - margin;
        }
        
        setMenuPosition({ top, left, openUpward });
      };
      
      // Calculate immediately
      calculatePosition();
      
      // Recalculate on scroll or resize
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);
      
      return () => {
        window.removeEventListener('scroll', calculatePosition, true);
        window.removeEventListener('resize', calculatePosition);
      };
    }
  }, [open, items.length]);

  const handleItemClick = (item: MenuItem) => {
    if (!item.disabled) {
      item.onClick();
      setOpen(false);
    }
  };

  const menuContent = open && mounted ? (
    <div 
      ref={menuRef}
      className="fixed w-48 bg-white rounded-md shadow-lg border border-gray-100 py-1 z-[9999]"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        maxHeight: '300px',
        overflowY: 'auto'
      }}
    >
      {items.map((item, index) => (
        <MenuItemComponent
          key={index}
          icon={item.icon}
          label={item.label}
          onClick={() => handleItemClick(item)}
          active={item.active}
          danger={item.danger}
          disabled={item.disabled}
        />
      ))}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`p-1.5 rounded-full border border-[#0078D4] flex items-center justify-center hover:bg-[rgba(236,247,253,1)] transition-colors ${buttonClassName}`}
        aria-label={label}
        title={label}
        suppressHydrationWarning
      >
        <MoreVertical size={16} className="text-[#0078D4]" />
      </button>
      
      {mounted && createPortal(menuContent, document.body)}
    </>
  );
}

interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

function MenuItemComponent({ 
  icon: Icon, 
  label, 
  onClick,
  active = false, 
  danger = false,
  disabled = false
}: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 w-full px-4 py-2 text-sm text-left transition-colors
        ${active ? 'bg-[rgba(236,247,253,1)] text-[#0078D4]' : ''}
        ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <Icon size={16} strokeWidth={2} />
      {label}
    </button>
  );
}