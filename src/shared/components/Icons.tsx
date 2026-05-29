import React from 'react';
import { Platform } from 'react-native';

// For Mobile, we use @expo/vector-icons
// For Web, we can use lucide-react or a shim
// Given the project's current state, we'll provide a unified interface

let Ionicons: any;

if (Platform.OS === 'web') {
  // Web implementation using lucide-react as icons map
  // or simple SVG wrapper if preferred. 
  // For now, let's try to use lucide-react equivalents for common Ionicons
  const Lucide = require('lucide-react');
  
  const iconMap: Record<string, any> = {
    'sparkles': Lucide.Sparkles,
    'sparkles-outline': Lucide.Sparkles,
    'search': Lucide.Search,
    'search-outline': Lucide.Search,
    'ellipsis-vertical': Lucide.MoreVertical,
    'ellipsis-vertical-outline': Lucide.MoreVertical,
    'call': Lucide.Phone,
    'call-outline': Lucide.Phone,
    'videocam': Lucide.Video,
    'videocam-outline': Lucide.Video,
    'information-circle': Lucide.Info,
    'information-circle-outline': Lucide.Info,
    'send': Lucide.Send,
    'send-outline': Lucide.Send,
    'happy': Lucide.Smile,
    'happy-outline': Lucide.Smile,
    'attach': Lucide.Paperclip,
    'attach-outline': Lucide.Paperclip,
    'image': Lucide.Image,
    'image-outline': Lucide.Image,
    'pencil': Lucide.Pencil,
    'pencil-outline': Lucide.Pencil,
    'person-circle': Lucide.UserCircle,
    'person-circle-outline': Lucide.UserCircle,
    'close': Lucide.X,
    'close-outline': Lucide.X,
    'chevron-back': Lucide.ChevronLeft,
    'chevron-forward': Lucide.ChevronRight,
  };

  Ionicons = ({ name, size, color, style }: any) => {
    const IconComponent = iconMap[name] || Lucide.HelpCircle;
    return <IconComponent size={size} color={color} style={style} />;
  };
} else {
  // Mobile implementation
  Ionicons = require('@expo/vector-icons').Ionicons;
}

export { Ionicons };
