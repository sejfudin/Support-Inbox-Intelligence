const authService = require('../services/authService');

const attachCookie = (res, refreshToken) => {
  const oneDay = 1000 * 60 * 60 * 24;
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(Date.now() + oneDay * 7),
    sameSite: 'strict',
  });
};

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    attachCookie(res, result.refreshToken);
    const { refreshToken, ...userData } = result;
    res.status(200).json(userData);
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken; 
    
    if (!refreshToken) throw new Error('No refresh token provided');

    const result = await authService.refresh(refreshToken);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch (dbError) {
        console.error('Logout DB Error:', dbError); 
      }
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  getMe,
  logout,
};