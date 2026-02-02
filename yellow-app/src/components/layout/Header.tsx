/**
 * Header Component
 * Application header with navigation and wallet connection
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletConnect } from '../wallet/WalletConnect';
import { useStore } from '../../store';

/**
 * Header component
 * Displays navigation, connection status, and wallet info
 */
export const Header: React.FC = () => {
  const location = useLocation();
  const { websocket, channel, auth } = useStore();

  /**
   * Check if a route is active
   */
  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-gray-900 border-b border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl">🎯</span>
              <span className="text-xl font-bold text-white">
                Nitrolite Markets
              </span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-4">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/')
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                Home
              </Link>
              <Link
                to="/market"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/market')
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                Market
              </Link>
              <Link
                to="/admin"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/admin')
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                Admin
              </Link>
            </nav>
          </div>

          {/* Status Indicators and Wallet */}
          <div className="flex items-center space-x-6">
            {/* Connection Status Indicators */}
            <div className="hidden lg:flex items-center space-x-3">
              {/* WebSocket Status */}
              <div className="flex items-center space-x-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    websocket.isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-xs text-gray-400">WS</span>
              </div>

              {/* Auth Status */}
              <div className="flex items-center space-x-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    auth.isAuthenticated ? 'bg-green-500' : 'bg-gray-500'
                  }`}
                />
                <span className="text-xs text-gray-400">Auth</span>
              </div>

              {/* Channel Status */}
              <div className="flex items-center space-x-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    channel.isOpen ? 'bg-green-500' : 'bg-gray-500'
                  }`}
                />
                <span className="text-xs text-gray-400">Channel</span>
              </div>
            </div>

            {/* Wallet Connection */}
            <WalletConnect />
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-800">
        <nav className="flex justify-around py-2">
          <Link
            to="/"
            className={`px-3 py-1 rounded text-sm ${
              isActive('/')
                ? 'text-white bg-gray-800'
                : 'text-gray-400'
            }`}
          >
            Home
          </Link>
          <Link
            to="/market"
            className={`px-3 py-1 rounded text-sm ${
              isActive('/market')
                ? 'text-white bg-gray-800'
                : 'text-gray-400'
            }`}
          >
            Market
          </Link>
          <Link
            to="/admin"
            className={`px-3 py-1 rounded text-sm ${
              isActive('/admin')
                ? 'text-white bg-gray-800'
                : 'text-gray-400'
            }`}
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
};