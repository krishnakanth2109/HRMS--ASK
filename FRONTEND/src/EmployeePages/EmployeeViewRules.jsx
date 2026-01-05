import React, { useState, useEffect } from 'react';
import axios from 'axios';

// --- SUB-COMPONENT: Single Rule Card (Handles Slider & Full Screen Logic) ---
const RuleCard = ({ rule }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  
  // New State for Full Screen Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  // --- ROBUST IMAGE DATA HANDLING ---
  const getImages = () => {
    if (rule.images && rule.images.length > 0) {
      return typeof rule.images[0] === 'string' 
        ? rule.images 
        : rule.images.map(img => img.url);
    }
    if (rule.fileUrl) return [rule.fileUrl];
    return [];
  };

  const images = getImages();

  // --- Auto-Slide Logic (Card Only) ---
  useEffect(() => {
    // Stop auto-slide if hovered OR if modal is open
    if (images.length > 1 && !isHovered && !isModalOpen) {
      const timer = setInterval(() => {
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }, 5000); 
      return () => clearInterval(timer);
    }
  }, [images.length, isHovered, isModalOpen]);

  // --- Card Navigation Handlers ---
  const handleNext = () => setCurrentImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  const handlePrev = () => setCurrentImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));

  // --- Modal Navigation Handlers ---
  const openModal = () => {
    setModalIndex(currentImageIndex); // Start from the image user is looking at
    setIsModalOpen(true);
    setIsHovered(true); // Pause background slider
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsHovered(false);
  };

  const handleModalNext = (e) => {
    e.stopPropagation();
    setModalIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleModalPrev = (e) => {
    e.stopPropagation();
    setModalIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  // Helper for Category Colors
  const getCategoryColor = (cat) => {
    switch(cat) {
      case 'Safety': return 'bg-red-100 text-red-700 border-red-200';
      case 'HR Policy': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'IT Security': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Management': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <>
      {/* --- NORMAL CARD VIEW --- */}
      <div className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-100 flex flex-col h-full">
        
        {/* Card Header */}
        <div className="p-6 pb-2">
          <div className="flex justify-between items-start mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getCategoryColor(rule.category)}`}>
              {rule.category}
            </span>
            <span className="text-xs text-gray-400 font-medium">
              {new Date(rule.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 leading-tight">
            {rule.title}
          </h3>
        </div>

        {/* Card Body */}
        <div className="p-6 pt-2 flex-grow">
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
            {rule.description}
          </p>
        </div>

        {/* Attachment / Slider Section */}
        {images.length > 0 && (
          <div className="bg-gray-50 p-4 border-t border-gray-100 mt-auto">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              Attachments ({images.length})
            </p>
            
            <div 
              className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-900 h-64 cursor-pointer"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={openModal} // Clicking container opens modal
            >
              {/* Image Display */}
              <div className="w-full h-full flex items-center justify-center relative bg-black">
                 <img 
                    src={images[currentImageIndex]} 
                    alt={`Attachment ${currentImageIndex + 1}`} 
                    className="max-w-full max-h-full object-contain transition-transform duration-700"
                    onError={(e) => { e.target.style.display = 'none'; }} 
                 />
                 
                 {/* Overlay Trigger */}
                 <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end items-end h-full">
                     <button 
                        onClick={(e) => { e.stopPropagation(); openModal(); }}
                        className="bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-gray-100 transition-colors"
                     >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                       Click to Expand
                     </button>
                 </div>
              </div>

              {/* Card Controls (Only if > 1 image) */}
              {images.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                    className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition opacity-0 group-hover:opacity-100 z-10"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>

                  <button 
                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition opacity-0 group-hover:opacity-100 z-10"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>

                  {/* Dots */}
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    {images.map((_, idx) => (
                      <div key={idx} className={`h-1.5 w-1.5 rounded-full shadow-sm ${idx === currentImageIndex ? 'bg-white' : 'bg-white/30'}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- FULL SCREEN MODAL POPUP --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          
          {/* Close Button */}
          <button 
            onClick={closeModal}
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all z-50"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>

          {/* Main Image Container */}
          <div className="relative w-full h-full flex items-center justify-center">
            
            <img 
              src={images[modalIndex]} 
              alt="Full Screen View" 
              className="max-h-screen max-w-full object-contain shadow-2xl rounded-sm select-none"
            />

            {/* Modal Navigation (Only if > 1 image) */}
            {images.length > 1 && (
              <>
                {/* Prev Button */}
                <button 
                  onClick={handleModalPrev}
                  className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-4 rounded-full backdrop-blur-sm transition-all hover:scale-110"
                >
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>

                {/* Next Button */}
                <button 
                  onClick={handleModalNext}
                  className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-4 rounded-full backdrop-blur-sm transition-all hover:scale-110"
                >
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                
                {/* Counter */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 px-4 py-1 rounded-full text-white text-sm border border-white/20">
                  {modalIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// --- MAIN PARENT COMPONENT ---
const EmployeeViewRules = () => {
  const [rules, setRules] = useState([]);
  const [filteredRules, setFilteredRules] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // --- 1. Fetch Rules ---
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/rules');
        setRules(res.data);
        setFilteredRules(res.data);
      } catch (error) {
        console.error("Error fetching rules", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  // --- 2. Search Logic ---
  useEffect(() => {
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = rules.filter(rule => 
      rule.title.toLowerCase().includes(lowerTerm) ||
      rule.category.toLowerCase().includes(lowerTerm)
    );
    setFilteredRules(filtered);
  }, [searchTerm, rules]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 font-sans text-gray-800">
      
      {/* --- Header Section --- */}
      <div className="max-w-6xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
          📋 Company <span className="text-blue-600">Rules & Regulations</span>
        </h1>
        <p className="text-gray-500 max-w-2xl mx-auto mb-8 text-lg">
          Stay updated with the latest policies, safety guidelines, and operational procedures.
        </p>

        {/* Search Bar */}
        <div className="relative max-w-xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-full leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition duration-150 ease-in-out sm:text-sm"
            placeholder="Search policies (e.g., 'Holiday', 'Safety')..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* --- Content Section --- */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300">
            <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-lg text-gray-500 font-medium">No regulations found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-8">
            {filteredRules.map((rule) => (
              <RuleCard key={rule._id} rule={rule} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeViewRules;