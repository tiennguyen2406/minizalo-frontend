import React from 'react';
import { Toaster } from 'react-hot-toast';

const UniversalToaster: React.FC = () => {
    return (
        <Toaster 
            position="top-center" 
            reverseOrder={false} 
            toastOptions={{
                style: {
                    zIndex: 999999,
                },
            }}
        />
    );
};

export default UniversalToaster;
