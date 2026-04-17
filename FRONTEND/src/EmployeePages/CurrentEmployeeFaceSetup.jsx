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
          className="space-y-8"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-8 text-center shadow-xl md:p-14">
            <div className="pointer-events-none absolute top-0 right-0 p-8 pt-12 text-purple-600 opacity-5">
              <FaCube size={180} />
            </div>

            <div className="mx-auto mb-6 flex h-24 w-24 rotate-3 items-center justify-center rounded-3xl bg-purple-50 shadow-inner">
              <FaUserShield className="-rotate-3 text-5xl text-purple-600" />
            </div>

            <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-slate-800 md:text-4xl">
              Face and Fingerprint Authentication
            </h2>

            <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-slate-500 md:text-lg">
              Manage both passwordless login methods in one place. Register your
              face for camera login or add your fingerprint for WebAuthn login.
            </p>

            <div className="mx-auto mb-12 grid max-w-3xl gap-6 text-left md:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-sm transition hover:shadow-md">
                <FaCheckCircle className="mb-3 text-2xl text-green-500" />
                <h4 className="font-bold tracking-wide text-slate-800">
                  Unified Setup
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  Face and fingerprint controls now live on this single page.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-sm transition hover:shadow-md">
                <FaCamera className="mb-3 text-2xl text-purple-500" />
                <h4 className="font-bold tracking-wide text-slate-800">
                  Face Recognition
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  Register your face with liveness checks for passwordless sign in.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-sm transition hover:shadow-md">
                <FaFingerprint className="mb-3 text-2xl text-emerald-500" />
                <h4 className="font-bold tracking-wide text-slate-800">
                  Fingerprint Login
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  Register your device fingerprint and use it directly on login.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowFaceRegister(true)}
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-4 text-lg font-bold text-white shadow-[0_8px_30px_rgb(99,102,241,0.3)] transition-all hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(99,102,241,0.5)]"
            >
              <span className="absolute h-0 w-0 rounded-full bg-white opacity-10 transition-all duration-300 ease-out group-hover:h-56 group-hover:w-60"></span>
              <FaCamera className="text-2xl animate-pulse" />
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
