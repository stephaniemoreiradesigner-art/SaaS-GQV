(function() {
    if (window.__GQV_UI_KIT_LINEAR__) return;
    window.__GQV_UI_KIT_LINEAR__ = true;

    const style = document.createElement('style');
    style.setAttribute('data-ui-kit', 'linear');
    style.textContent = `
        :root{
            --brand-primary: var(--color-primary, #6d28d9);
            --brand-primary-hover: var(--color-primary-hover, #5b21b6);
            --brand-secondary: var(--color-secondary, #f59e0b);
            --brand-bg: #f7f7f8;
            --brand-surface: #ffffff;
            --brand-surface-2: #fbfbfc;
            --brand-border: rgba(15, 23, 42, 0.10);
            --brand-text: #0f172a;
            --brand-muted: rgba(15, 23, 42, 0.62);
            --brand-subtle: rgba(15, 23, 42, 0.04);
            --brand-shadow: 0 1px 0 rgba(15, 23, 42, 0.04), 0 12px 32px rgba(15, 23, 42, 0.10);
            --brand-radius-lg: 16px;
            --brand-radius-md: 12px;
            --brand-radius-sm: 10px;
        }

        html, body { background: var(--brand-bg); }
        body { color: var(--brand-text); }

        .ui-surface{
            background: var(--brand-surface);
            border: 1px solid var(--brand-border);
            border-radius: var(--brand-radius-lg);
            box-shadow: none;
        }

        .ui-surface-2{
            background: var(--brand-surface-2);
            border: 1px solid var(--brand-border);
            border-radius: var(--brand-radius-lg);
        }

        .ui-card{
            background: var(--brand-surface);
            border: 1px solid var(--brand-border);
            border-radius: var(--brand-radius-lg);
            transition: box-shadow 140ms ease, transform 140ms ease, border-color 140ms ease, background 140ms ease;
        }
        .ui-card:hover{
            box-shadow: var(--brand-shadow);
            transform: translateY(-1px);
        }

        .ui-btn{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 12px;
            padding: 10px 12px;
            font-weight: 600;
            font-size: 12px;
            line-height: 1;
            transition: background 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
        }
        .ui-btn:disabled{
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        .ui-btn-primary{
            background: var(--brand-primary);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.14);
        }
        .ui-btn-primary:hover{
            background: var(--brand-primary-hover);
        }
        .ui-btn-secondary{
            background: var(--brand-surface);
            color: var(--brand-text);
            border: 1px solid var(--brand-border);
        }
        .ui-btn-secondary:hover{
            background: var(--brand-subtle);
        }
        .ui-btn-ghost{
            background: transparent;
            color: var(--brand-muted);
            border: 1px solid transparent;
        }
        .ui-btn-ghost:hover{
            background: var(--brand-subtle);
            color: var(--brand-text);
        }

        .ui-pill{
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.02em;
            border: 1px solid var(--brand-border);
            background: var(--brand-surface);
            color: var(--brand-muted);
        }

        .ui-pill-primary{
            border-color: rgba(109,40,217,0.18);
            background: color-mix(in srgb, var(--brand-primary) 10%, var(--brand-surface));
            color: color-mix(in srgb, var(--brand-primary) 70%, var(--brand-text));
        }

        .ui-brand-icon{
            background: color-mix(in srgb, var(--brand-primary) 12%, var(--brand-surface));
            color: color-mix(in srgb, var(--brand-primary) 85%, var(--brand-text));
            border: 1px solid rgba(109,40,217,0.16);
        }

        .ui-input{
            width: 100%;
            border-radius: 12px;
            border: 1px solid var(--brand-border);
            padding: 10px 12px;
            font-size: 13px;
            background: var(--brand-surface);
            color: var(--brand-text);
            outline: none;
            transition: border-color 140ms ease, box-shadow 140ms ease;
        }
        .ui-input:focus{
            border-color: color-mix(in srgb, var(--brand-primary) 40%, var(--brand-border));
            box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand-primary) 14%, transparent);
        }

        .ui-tabs{
            display: inline-flex;
            gap: 6px;
            padding: 6px;
            border-radius: 14px;
            border: 1px solid var(--brand-border);
            background: var(--brand-surface);
        }
        .ui-tab{
            border-radius: 12px;
            padding: 10px 12px;
            font-size: 12px;
            font-weight: 700;
            color: var(--brand-muted);
            background: transparent;
            border: 1px solid transparent;
            transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
        }
        .ui-tab:hover{
            background: var(--brand-subtle);
            color: var(--brand-text);
        }
        .ui-tab[data-active="true"]{
            background: color-mix(in srgb, var(--brand-primary) 10%, var(--brand-surface));
            color: color-mix(in srgb, var(--brand-primary) 80%, var(--brand-text));
            border-color: rgba(109,40,217,0.18);
        }

        .ui-drawer{
            background: var(--brand-surface);
            border-left: 1px solid var(--brand-border);
        }

        .ui-empty{
            background: var(--brand-surface);
            border: 1px dashed color-mix(in srgb, var(--brand-border) 70%, transparent);
            border-radius: var(--brand-radius-lg);
        }

        .v2-nav-btn, .portal-nav-btn{
            border-radius: 14px !important;
            border: 1px solid transparent;
            transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
        }
        .v2-nav-btn:hover, .portal-nav-btn:hover{
            background: var(--brand-subtle) !important;
        }
        .v2-nav-btn.bg-slate-100, .portal-nav-btn.bg-slate-100{
            background: color-mix(in srgb, var(--brand-primary) 10%, var(--brand-surface)) !important;
            border-color: rgba(109,40,217,0.18) !important;
        }
        .v2-nav-btn.bg-slate-100 i, .portal-nav-btn.bg-slate-100 i{
            color: color-mix(in srgb, var(--brand-primary) 80%, var(--brand-text)) !important;
        }

        #portal-sidebar, aside{
            background: var(--brand-surface) !important;
        }
        header{
            background: var(--brand-surface) !important;
        }
    `;
    document.head.appendChild(style);
})();

