import styles from "./page.module.css";

export default function GoogleSignIn() {
  return (
    <>
      <form action="/api/auth/google" method="post">
        <button type="submit" className={styles.googleSignIn}>Google ile devam et</button>
      </form>
      <p className={styles.authDivider}>veya e-posta ile</p>
    </>
  );
}
