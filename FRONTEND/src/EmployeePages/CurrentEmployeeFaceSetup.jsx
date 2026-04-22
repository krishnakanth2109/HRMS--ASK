import React, { useState } from "react";
import {
  FaCamera,
  FaCheckCircle,
  FaCube,
  FaFingerprint,
  FaUserShield,
} from "react-icons/fa";
import FaceRegister from "../components/FaceRegister";
import FingerprintSetupCard from "../components/FingerprintSetupCard";
import { motion } from "framer-motion";

const CurrentEmployeeFaceSetup = () => {
  const [showFaceRegister, setShowFaceRegister] = useState(false);

  return (
    <div className="mx-auto min-h-[85vh] max-w-6xl p-4 md:p-8">
      {!showFaceRegister ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-8 lg:grid-cols-2 lg:items-stretch"
        >
          <div className="flex h-full flex-col rounded-[2rem] border border-purple-100 bg-white p-6 md:p-10 shadow-lg shadow-purple-100/60">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 shadow-inner">
                <FaCamera className="text-3xl" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-purple-500">
                  Face ID
                </p>
                <h3 className="mt-1 text-2xl font-extrabold text-slate-800">
                  Register Face Login
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Register your face with liveness checks to enable completely passwordless sign in.
                </p>
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="mb-2 flex items-center gap-2 text-slate-700">
                  <FaUserShield className="text-purple-500" />
                  <span className="text-sm font-semibold">Liveness Detection</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  Ensures real-time presence to prevent spoofing with photos.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="mb-2 flex items-center gap-2 text-slate-700">
                  <FaCheckCircle className="text-blue-500" />
                  <span className="text-sm font-semibold">Quick Verification</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  Log in to your dashboard instantly using your device's camera.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowFaceRegister(true)}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-200 transition-all duration-300 hover:from-purple-600 hover:to-indigo-700"
            >
              <FaCamera className="text-lg animate-pulse" />
              Launch Face Setup Scanner
            </button>
          </div>

          <FingerprintSetupCard />
        </motion.div>
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
