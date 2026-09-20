import { ArrowRight, GitBranch, ScanSearch, Github, LogOut } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { Brand } from '@/components/brand';
import { useAuth } from '@/services/authState';

export default function Landing() {
  const [, setLocation] = useLocation();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const { isAuthenticated, user, isLoading, login, logout } = useAuth();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = url.trim();
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(value)) { setError('Enter a GitHub repository URL to continue.'); return; }
    
    // We don't store the URL in sessionStorage anymore, we pass it to analysis page
    setLocation(`/analysis?repo=${encodeURIComponent(value)}`);
  };

  return (
    <main className="noise surface-grid min-h-[100dvh] overflow-hidden">
      <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-6 lg:px-10">
        <Brand />
        <div className="flex items-center gap-4">
          <span className="mono text-[9px] tracking-[0.18em] text-muted-foreground hidden sm:block">PHASE 0 / MAPPING INSTRUMENT</span>
          
          {isLoading ? (
            <div className="h-8 w-24 animate-pulse bg-muted rounded"></div>
          ) : isAuthenticated && user ? (
            <div className="flex items-center gap-3 border border-border bg-card px-3 py-1.5 rounded-full">
              <img src={user.avatar_url} alt={user.login} className="w-5 h-5 rounded-full" />
              <span className="text-xs font-medium text-foreground">{user.login}</span>
              <button onClick={logout} className="text-muted-foreground hover:text-foreground ml-2">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={login}
              className="flex items-center gap-2 border border-border bg-card hover:bg-muted px-4 py-1.5 text-xs font-medium text-foreground transition-colors rounded-full"
            >
              <Github className="w-3.5 h-3.5" /> Connect GitHub
            </button>
          )}
        </div>
      </header>
      <div className="mx-auto grid min-h-[calc(100dvh-88px)] w-full max-w-[1280px] items-center gap-16 px-6 pb-16 pt-8 lg:grid-cols-[1.08fr_.92fr] lg:gap-20 lg:px-10">
        <section className="entrance">
          <p className="mono mb-7 flex items-center gap-3 text-[10px] tracking-[0.2em] text-primary"><span className="h-px w-8 bg-primary" />CODEBASE CARTOGRAPHY</p>
          <h1 className="max-w-[720px] text-[clamp(3.2rem,7vw,6.7rem)] font-semibold leading-[.94] tracking-[-.065em] text-foreground">Explore your<br /><span className="text-primary">codebase</span> as a world.</h1>
          <p className="mt-8 max-w-[490px] text-[15px] leading-7 text-muted-foreground">Turn any GitHub repository into an interactive map of its architecture.</p>
          
          {isAuthenticated ? (
            <form onSubmit={submit} className="mt-12 max-w-[590px]">
              <label htmlFor="repo-url" className="mono mb-2 block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Repository URL</label>
              <div className={`flex flex-col border bg-card transition-colors sm:flex-row ${error ? 'border-destructive' : 'border-border focus-within:border-primary'}`}>
                <div className="flex min-w-0 flex-1">
                  <div className="flex items-center border-r border-border px-3 text-muted-foreground"><GitBranch className="h-4 w-4" /></div>
                  <input id="repo-url" data-testid="input-repository-url" value={url} onChange={(event) => { setUrl(event.target.value); setError(''); }} placeholder="https://github.com/owner/repository" className="min-w-0 flex-1 bg-transparent px-3 py-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/50" />
                </div>
                <button type="submit" data-testid="button-build-world" className="m-1.5 mt-0 inline-flex items-center justify-center gap-2 bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/85 sm:mt-1.5">Build World <ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
              {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : <p className="mt-2 text-[11px] text-muted-foreground">Private repositories supported if you grant access during GitHub connect.</p>}
            </form>
          ) : (
            <div className="mt-12 max-w-[590px] border border-border bg-card/50 p-6">
              <h3 className="text-sm font-medium text-foreground mb-2">Authentication Required</h3>
              <p className="text-sm text-muted-foreground mb-4">Please connect your GitHub account to analyze repositories. The backend requires authentication to prevent rate limiting and enable private repository access.</p>
              <button 
                onClick={login}
                className="inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
              >
                <Github className="w-4 h-4" /> Connect with GitHub
              </button>
            </div>
          )}
        </section>
        <section className="entrance-delay relative hidden min-h-[430px] lg:block" aria-label="Repository map preview">
          <div className="absolute inset-8 border border-border/70">
            <div className="absolute -left-1 -top-1 h-2 w-2 border-l border-t border-primary" /><div className="absolute -right-1 -top-1 h-2 w-2 border-r border-t border-primary" /><div className="absolute -bottom-1 -left-1 h-2 w-2 border-b border-l border-primary" /><div className="absolute -bottom-1 -right-1 h-2 w-2 border-b border-r border-primary" />
            <div className="absolute left-1/2 top-0 h-full border-l border-dashed border-border/60" /><div className="absolute left-0 top-1/2 w-full border-t border-dashed border-border/60" />
            <div className="absolute left-[18%] top-[22%] h-20 w-28 border border-primary/55 bg-primary/5 p-3"><p className="mono text-[9px] text-primary">apps / web</p><span className="mt-3 block h-px w-12 bg-primary/40" /><span className="mt-2 block h-px w-20 bg-border" /></div>
            <div className="absolute right-[14%] top-[31%] h-24 w-32 border border-border bg-card p-3"><p className="mono text-[9px] text-muted-foreground">apps / api</p><span className="mt-3 block h-px w-16 bg-border" /><span className="mt-2 block h-px w-22 bg-border" /></div>
            <div className="absolute bottom-[18%] left-[31%] h-20 w-32 border border-border bg-card p-3"><p className="mono text-[9px] text-muted-foreground">packages / core</p><span className="mt-3 block h-px w-20 bg-border" /><span className="mt-2 block h-px w-14 bg-border" /></div>
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 450 430" fill="none" aria-hidden="true"><path d="M120 143L320 181L205 314" stroke="#b79b59" strokeDasharray="4 7" opacity=".55" /><circle cx="120" cy="143" r="3" fill="#c5a963" /><circle cx="320" cy="181" r="3" fill="#c5a963" /><circle cx="205" cy="314" r="3" fill="#c5a963" /></svg>
          </div>
          <div className="absolute bottom-0 left-0 flex items-center gap-2 text-muted-foreground"><ScanSearch className="h-4 w-4 text-primary" /><span className="mono text-[10px]">STRUCTURE / DEPENDENCY / HISTORY</span></div>
        </section>
      </div>
    </main>
  );
}