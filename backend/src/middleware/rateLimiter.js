const rateLimit = (windowMs, maxRequests, message) => {
  const requests = new Map();

  // Periodically clean up expired request timestamps to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const active = timestamps.filter(t => now - t < windowMs);
      if (active.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, active);
      }
    }
  }, windowMs * 2);

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!requests.has(ip)) {
      requests.set(ip, []);
    }

    const timestamps = requests.get(ip).filter(t => now - t < windowMs);
    timestamps.push(now);
    requests.set(ip, timestamps);

    if (timestamps.length > maxRequests) {
      return res.status(429).json({
        success: false,
        message: message || 'Too many requests from this IP. Please try again later.'
      });
    }

    next();
  };
};

module.exports = rateLimit;
