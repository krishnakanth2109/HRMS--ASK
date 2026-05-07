import React, { useState } from "react";
import {
  FaCamera,
  FaCheckCircle,
  FaCube,
  FaFingerprint,
  FaUserShield,
  FaChrome,
  FaCode,
  FaRocket,
  FaPlusCircle,
  FaSave,
  FaSearchPlus,
  FaTimes,
  FaBook,
} from "react-icons/fa";
import FaceRegister from "../components/FaceRegister";
import FingerprintSetupCard from "../components/FingerprintSetupCard";
import { motion, AnimatePresence } from "framer-motion";

// Orange arrow component
const OrangeArrow = ({ top, left, width = "12%" }) => (
  <div className="absolute z-10 pointer-events-none" style={{ top, left, width, transform: 'translateY(-50%)' }}>
    <svg width="100%" viewBox="0 0 120 24" fill="none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="arrowGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <rect x="0" y="7" width="85" height="10" rx="5" fill="url(#arrowGrad)" />
      <polygon points="85,0 120,12 85,24" fill="url(#arrowGrad)" />
    </svg>
  </div>
);



const CurrentEmployeeFaceSetup = () => {
  const [showFaceRegister, setShowFaceRegister] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);

  return (
    <div className="mx-auto min-h-[85vh] max-w-7xl p-4 md:p-8">
      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
            onClick={() => setLightboxImg(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="relative max-w-5xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxImg(null)}
                className="absolute -top-14 right-0 flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium transition-colors bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm"
              >
                <FaTimes /> Close
              </button>
              <div className="relative inline-block w-full">
                <img
                  src={lightboxImg.src}
                  alt={lightboxImg.label || "Expanded Step Image"}
                  className="w-full rounded-3xl shadow-2xl border border-white/10"
                />
                {lightboxImg.arrow && (
                  <OrangeArrow
                    top={lightboxImg.arrow.top}
                    left={lightboxImg.arrow.left}
                    width={lightboxImg.arrow.width}
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showFaceRegister ? (
        <div className="flex flex-col gap-12">
          {/* Settings Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2"
          >
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-800">
              Settings
            </h1>
            <p className="mt-3 text-lg text-slate-500 max-w-3xl">
              Here you can manage your face ID, fingerprint authentication, and access Tampermonkey guidance.
            </p>
          </motion.div>

          {/* Main Cards Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-8 lg:grid-cols-2 lg:items-stretch"
          >
            <div className="flex h-full flex-col rounded-[2.5rem] border border-purple-100 bg-white p-8 md:p-10 shadow-xl shadow-purple-100/40">
              <div className="mb-6 flex items-start gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 shadow-inner">
                  <FaCamera className="text-4xl" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-purple-500">
                    Face ID
                  </p>
                  <h3 className="mt-1 text-3xl font-black text-slate-800">
                    Register Face Login
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Register your face with liveness checks to enable completely passwordless sign in.
                  </p>
                </div>
              </div>

              <div className="mb-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5">
                  <div className="mb-3 flex items-center gap-2 text-slate-700">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                      <FaUserShield />
                    </div>
                    <span className="text-sm font-bold">Liveness Detection</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">
                    Ensures real-time presence to prevent spoofing with photos or videos.
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5">
                  <div className="mb-3 flex items-center gap-2 text-slate-700">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                      <FaCheckCircle />
                    </div>
                    <span className="text-sm font-bold">Quick Verification</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-500">
                    Log in to your dashboard instantly using your device's camera.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowFaceRegister(true)}
                className="mt-auto flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-gradient-to-r from-purple-600 to-indigo-700 px-6 py-4 text-base font-bold text-white shadow-lg shadow-purple-200 transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px]"
              >
                <FaCamera className="text-xl animate-pulse" />
                Launch Face Setup Scanner
              </button>
            </div>

            <FingerprintSetupCard />
          </motion.div>

          {/* Vertical Setup Guide Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-[3rem] border border-purple-100 bg-white p-8 md:p-12 shadow-xl shadow-purple-50"
          >
            {/* Background Decorative Elements */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-200/30 blur-[80px]" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-200/30 blur-[80px]" />

            <div className="relative z-10 mb-12 text-center md:text-left">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-purple-500 mb-2">
                Step-by-Step
              </p>
              <h2 className="text-3xl font-black tracking-tight text-slate-800 md:text-4xl">
                System Configuration Guide
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500 md:mx-0">
                Follow these detailed steps to set up Tampermonkey for your HRMS environment. This ensures all automated features work seamlessly.
              </p>
              <div className="mt-6 flex justify-center md:justify-start">
                <a
                  href="https://docs.google.com/document/d/111UdyP2es0g0n11HGpvwTF7_4TPvAsGQ/edit?usp=sharing&ouid=100321873313062611617&rtpof=true&sd=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-100 px-5 py-3 text-sm font-bold text-purple-700 transition-all duration-300 hover:bg-purple-200 hover:-translate-y-1 hover:shadow-md"
                >
                  <FaBook className="text-lg" />
                  Click here to open clear documentation over the process
                </a>
              </div>
            </div>

      
          </motion.div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <FaceRegister onClose={() => setShowFaceRegister(false)} />
        </motion.div>
      )}
    </div>
  );
};

export default CurrentEmployeeFaceSetup;
