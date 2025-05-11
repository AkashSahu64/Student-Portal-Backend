/**
 * Extract YouTube video ID from URL
 * @param {String} url - YouTube URL
 * @returns {String|null} YouTube video ID or null if invalid
 */
const extractYoutubeId = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

/**
 * Get YouTube video information using the video ID
 * @param {String} url - YouTube video URL
 * @returns {Promise<Object>} Video information
 */
exports.getVideoInfo = async (url) => {
  try {
    const videoId = extractYoutubeId(url);
    
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    // In a real implementation, you'd use the YouTube API
    // For this example, we'll return mock data
    
    // NOTE: In production, use the YouTube Data API v3 to get video info
    // Example API endpoint: https://www.googleapis.com/youtube/v3/videos?id={videoId}&part=snippet,contentDetails&key={API_KEY}
    
    return {
      videoId,
      title: 'Sample YouTube Video', // Would come from API
      description: 'This is a sample description', // Would come from API
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: 300, // Sample duration in seconds, would come from API
      publishedAt: new Date().toISOString(), // Would come from API
    };
  } catch (error) {
    console.error('YouTube service error:', error);
    return null;
  }
};

/**
 * Search YouTube videos by keywords
 * @param {String} query - Search query
 * @param {Number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} Search results
 */
exports.searchVideos = async (query, maxResults = 10) => {
  try {
    // In a real implementation, use the YouTube Data API
    // Example API endpoint: https://www.googleapis.com/youtube/v3/search?part=snippet&q={query}&maxResults={maxResults}&key={API_KEY}
    
    // Mock data for this example
    return Array(maxResults).fill(0).map((_, i) => ({
      videoId: `sample${i}`,
      title: `Search Result ${i + 1} for "${query}"`,
      description: `This is a sample search result ${i + 1} for the query "${query}"`,
      thumbnailUrl: 'https://via.placeholder.com/120x90',
      publishedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('YouTube search error:', error);
    return [];
  }
};

/**
 * Get related videos for a given video ID
 * @param {String} videoId - YouTube video ID
 * @param {Number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} Related videos
 */
exports.getRelatedVideos = async (videoId, maxResults = 5) => {
  try {
    // In a real implementation, use the YouTube Data API
    // Example API endpoint: https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId={videoId}&type=video&maxResults={maxResults}&key={API_KEY}
    
    // Mock data for this example
    return Array(maxResults).fill(0).map((_, i) => ({
      videoId: `related${i}`,
      title: `Related Video ${i + 1}`,
      description: `This is a related video ${i + 1} for video ID ${videoId}`,
      thumbnailUrl: 'https://via.placeholder.com/120x90',
      publishedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('YouTube related videos error:', error);
    return [];
  }
};