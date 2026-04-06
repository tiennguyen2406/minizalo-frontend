import React, { useState } from 'react';

interface LazyImageProps {
    src: string;
    alt: string;
    style?: React.CSSProperties;
    onClick?: () => void;
    onLoad?: () => void;
}

const LazyImage: React.FC<LazyImageProps> = ({ src, alt, style, onClick, onLoad }) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    return (
        <img
            src={src}
            alt={alt}
            style={{
                ...style,
                opacity: loaded ? 1 : 0.5,
                transition: 'opacity 0.3s ease'
            }}
            onClick={onClick}
            onLoad={() => {
                setLoaded(true);
                onLoad?.();
            }}
            onError={() => setError(true)}
        />
    );
};

export default LazyImage;
