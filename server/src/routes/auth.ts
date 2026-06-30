import { Router, Request, Response, NextFunction } from "express";
import { db, randomUUID } from "../db.js";
import { signToken, authMiddleware, AuthRequest } from "../middleware/auth.js";
import { getTossUserKey } from "../services/tossLogin.js";

const router = Router();

// 사용자 승인: 빨래요(carelabel) 등 다른 앱의 unlink 콜백과 동일하게 Basic Auth 강제 검증을 제거함.
// 불일치는 로그로만 남기고 막지 않음 — 토스 콘솔이 헤더를 어떻게 보내는지 확실치 않아 검증보다 호환성 우선.
function checkUnlinkAuth(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.UNLINK_BASIC_AUTH;
  if (expected && req.headers.authorization !== expected) {
    console.warn("[Unlink] Basic Auth 불일치 (차단하지 않고 통과시킴)");
  }
  next();
}

router.post("/login", (req: Request, res: Response): void => {
  const { anonymousKey, authorizationCode, referrer } = req.body as {
    anonymousKey: string;
    authorizationCode?: string;
    referrer?: string;
  };

  if (!anonymousKey) {
    res.status(400).json({ error: "anonymousKey가 필요해요." });
    return;
  }

  try {
    let user = db.findUserByKey(anonymousKey);

    if (!user) {
      user = {
        id: randomUUID(),
        anonymousKey,
        nickname: null,
        tossUserKey: null,
        notificationAgreed: false,
        createdAt: new Date().toISOString(),
      };
      db.createUser(user);
    }

    if (authorizationCode && referrer && !user.tossUserKey) {
      getTossUserKey(authorizationCode, referrer)
        .then((tossUserKey) => {
          if (tossUserKey) {
            db.setTossUserKey(user!.id, tossUserKey);
          }
        })
        .catch(() => {});
    }

    const token = signToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        notificationAgreed: user.notificationAgreed,
      },
    });
  } catch (error) {
    console.error("[AUTH]", error);
    res.status(500).json({ error: "로그인 중 오류가 발생했어요." });
  }
});

router.post("/refresh-toss-key", authMiddleware, (req: AuthRequest, res: Response): void => {
  const { authorizationCode, referrer } = req.body as {
    authorizationCode?: string;
    referrer?: string;
  };

  if (!authorizationCode || !referrer) {
    res.status(400).json({ error: "authorizationCode, referrer 필요" });
    return;
  }

  const user = db.findUserById(req.userId!);
  if (!user) { res.status(404).json({ error: "유저 없음" }); return; }

  if (user.tossUserKey) {
    res.json({ ok: true, already: true });
    return;
  }

  getTossUserKey(authorizationCode, referrer)
    .then((tossUserKey) => {
      if (tossUserKey) db.setTossUserKey(user.id, tossUserKey);
    })
    .catch(() => {});

  res.json({ ok: true });
});

router.patch("/me", authMiddleware, (req: AuthRequest, res: Response): void => {
  const { nickname, notificationAgreed } = req.body as { nickname?: string; notificationAgreed?: boolean };

  if (nickname !== undefined) {
    if (nickname.trim().length === 0) {
      res.status(400).json({ error: "별명을 입력해주세요." });
      return;
    }
    if (nickname.length > 10) {
      res.status(400).json({ error: "별명은 10자 이내로 입력해주세요." });
      return;
    }
    db.updateUser(req.userId!, { nickname: nickname.trim() });
  }

  if (notificationAgreed !== undefined) {
    db.updateUser(req.userId!, { notificationAgreed });
  }

  const user = db.findUserById(req.userId!);
  res.json({ ok: true, nickname: user?.nickname, notificationAgreed: user?.notificationAgreed });
});

router.delete("/me", authMiddleware, (req: AuthRequest, res: Response): void => {
  db.deleteUser(req.userId!);
  res.json({ ok: true });
});

// 앱인토스 콘솔에 등록하는 연결 끊기(Unlink) 웹훅 — 사용자가 토스에서 미룰래 연결을 끊으면 호출됨
// 콘솔에서 HTTP 메서드를 GET/POST 어느 쪽으로 설정해도 동작하도록 둘 다 지원
function handleUnlink(req: Request, res: Response): void {
  const userKey = Number((req.body as { userKey?: number })?.userKey ?? req.query.userKey);
  if (!userKey) { res.json({ ok: true }); return; }

  const user = db.findUserByTossKey(userKey);
  if (user) {
    db.deleteUser(user.id);
    console.log(`[Unlink] 유저 데이터 삭제: tossUserKey=${userKey}`);
  }
  res.json({ ok: true });
}

router.get("/unlink", checkUnlinkAuth, handleUnlink);
router.post("/unlink", checkUnlinkAuth, handleUnlink);

export default router;
