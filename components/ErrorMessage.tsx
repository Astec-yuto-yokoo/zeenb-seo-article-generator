
import React from 'react';
import { ErrorIcon } from './icons';

interface ErrorMessageProps {
  message: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl relative shadow-sm" role="alert">
        <div className="flex items-center">
            <ErrorIcon className="w-6 h-6 mr-3 text-red-500"/>
            <div>
                <strong className="font-bold text-red-800">エラーが発生しました</strong>
                <span className="block sm:inline ml-2 text-red-600">{message}</span>
            </div>
        </div>
    </div>
  );
};

export default ErrorMessage;
