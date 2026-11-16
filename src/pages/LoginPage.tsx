
import React, { useState } from 'react';
import {
  Mail,
  Lock,
  LogIn,
  AlertCircle,
} from 'lucide-react';

import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import { auth, db } from '../services/firebase';
import { store } from '../services/store';
import type { User } from '../types';

interface Props {
  onSuccess: () => void;
  onNavigateToRegister: () => void;
}

export const LoginPage: React.FC<Props> = ({
  onSuccess,
  onNavigateToRegister,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    if (!auth || !db) {
      setError('Firebase ยังไม่ได้เชื่อมต่อ');
      return;
    }

    setLoading(true);

    try {
      // 1. ตรวจสอบบัญชีกับ Firebase Authentication
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const firebaseUser = credential.user;

      // 2. ค้นหาข้อมูลผู้ใช้ด้วย Firebase UID
      // รองรับ Document ID ที่แตกต่างกัน เช่น ADMIN001 และ M001
      const userQuery = query(
        collection(db, 'users'),
        where('uid', '==', firebaseUser.uid)
      );

      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        await auth.signOut();
        setError(
          'ไม่พบข้อมูลผู้ใช้ใน Firestore กรุณาตรวจสอบ UID'
        );
        return;
      }

      if (userSnapshot.size > 1) {
        await auth.signOut();
        setError(
          'พบข้อมูลผู้ใช้ซ้ำใน Firestore กรุณาตรวจสอบ UID'
        );
        return;
      }

      const userData = userSnapshot.docs[0].data();

      // 3. ตรวจสอบ UID
      if (userData.uid !== firebaseUser.uid) {
        await auth.signOut();
        setError(
          'UID ใน Firestore ไม่ตรงกับบัญชีที่เข้าสู่ระบบ'
        );
        return;
      }

      // 4. ตรวจสอบสิทธิ์ Admin และ Member
      const role = String(userData.role || '').toLowerCase();

      if (role !== 'admin' && role !== 'member') {
        await auth.signOut();
        setError('บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน');
        return;
      }

      // 5. สร้างข้อมูลผู้ใช้
      const currentUser: User = {
        uid: firebaseUser.uid,
        fullName:
          userData.fullName ||
          userData.fullname ||
          firebaseUser.displayName ||
          '',
        email: firebaseUser.email || email.trim(),
        phone: userData.phone || '',
        address: userData.address || '',
        role: role as User['role'],
        createdAt:
          userData.createdAt || new Date().toISOString(),
      };

      // 6. บันทึกข้อมูลผู้ใช้ลง Store
      store.setCurrentUser(currentUser);

      // 7. เข้าสู่ระบบสำเร็จ
      onSuccess();

    } catch (error: any) {
      console.error('Firebase Login Error:', error);

      const messages: Record<string, string> = {
        'auth/user-not-found': 'ไม่พบบัญชีผู้ใช้นี้',
        'auth/wrong-password': 'รหัสผ่านไม่ถูกต้อง',
        'auth/invalid-credential':
          'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
        'auth/too-many-requests':
          'ลองเข้าสู่ระบบใหม่ภายหลัง',
        'permission-denied':
          'ไม่มีสิทธิ์อ่านข้อมูลผู้ใช้ใน Firestore',
      };

      setError(
        messages[error.code] ||
        error.message ||
        'เข้าสู่ระบบไม่สำเร็จ'
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-8">

      <div className="text-center space-y-2">
        <span className="font-serif-luxury text-3xl font-light tracking-[0.25em] text-[#8B735E]">
          DRESSÉ
        </span>

        <h1 className="font-serif-luxury text-2xl font-bold text-[#292929]">
          เข้าสู่ระบบสมาชิก
        </h1>

        <p className="text-xs text-[#736E6A]">
          ยินดีต้อนรับกลับสู่บริการเช่าชุดราตรีระดับพรีเมียม
        </p>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-[#E8D8D2] shadow-luxury space-y-6">

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleLogin}
          className="space-y-4 text-xs"
        >

          <div>
            <label className="block text-[#292929] font-medium mb-1">
              อีเมลผู้ใช้งาน (Email)
            </label>

            <div className="relative">
              <Mail className="w-4 h-4 text-[#736E6A] absolute left-3 top-1/2 -translate-y-1/2" />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="กรอกอีเมลของคุณ"
                className="w-full pl-9 pr-3 py-2.5 bg-[#FAF8F5] border border-[#E8D8D2] rounded-xl focus:outline-hidden focus:border-[#8B735E]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#292929] font-medium mb-1">
              รหัสผ่าน (Password)
            </label>

            <div className="relative">
              <Lock className="w-4 h-4 text-[#736E6A] absolute left-3 top-1/2 -translate-y-1/2" />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านของคุณ"
                className="w-full pl-9 pr-3 py-2.5 bg-[#FAF8F5] border border-[#E8D8D2] rounded-xl focus:outline-hidden focus:border-[#8B735E]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#736E6A]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-[#8B735E]"
              />
              <span>จดจำการเข้าสู่ระบบ</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#8B735E] hover:bg-[#6F5B49] text-white text-xs font-semibold tracking-wider uppercase rounded-xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />

            <span>
              {loading
                ? 'กำลังเข้าสู่ระบบ...'
                : 'เข้าสู่ระบบ'}
            </span>
          </button>

        </form>

        <div className="text-center pt-2 border-t border-[#E8D8D2] text-xs text-[#736E6A]">
          <span>ยังไม่มีบัญชีสมาชิก? </span>

          <button
            onClick={onNavigateToRegister}
            className="font-semibold text-[#8B735E] hover:underline ml-1"
          >
            สมัครสมาชิกใหม่
          </button>
        </div>

      </div>
    </div>
  );
};
