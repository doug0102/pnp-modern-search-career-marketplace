import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { BaseWebComponent } from '@pnp/modern-search-extensibility';
import { useTheme, Link } from '@fluentui/react';
import * as DOMPurify from 'dompurify';
import { SelectLanguage } from './SelectLanguage';
import { Globals, Language } from './Globals';
import './CustomComponent.scss'

export interface ICustomComponentProps {
    path?: string;
    applicationDeadlineDate?: Date;
    cityEn?: string;
    cityFr?: string;
    classificationLevel?: string;
    classificationCodeEn?: string;
    classificationCodeFr?: string;
    contactEmail?: string;
    contactName?: string;
    durationEn?: string;
    durationFr?: string;
    durationQuantity?: string;
    jobDescriptionEn?: string;
    jobDescriptionFr?: string;
    jobTitleEn?: string;
    jobTitleFr?: string;
    jobType?: string;
    applyEmail?: string;
}

interface IHighlightResult {
    html: string;
    matchCount: number;
}

const getContactNameInitials = (name?: string): string => {
    if (!name) return 'NA';
    const parts = name.toUpperCase().split(' ');
    return parts[0] ? parts[0][0] + (parts[1] ? parts[1][0] : '') : 'NA';
};

const formatDeadline = (date?: Date): string => {
    if (!date) return 'N/A';
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return date.toLocaleString('en-US', { timeZone });
};

// Fallback when term translations aren't available, uses the label stored in the item
const termLabelDefaultLanguage = (value?: string): string => {
    if (!value) return '';
    const split = value.split(';GTSet');
    const count = split.length - (split.length > 1 ? 1 : 0);
    return split
        .slice(0, count)
        .map(s => {
            const parts = s.split('|');
            return parts[parts.length - 1];
        })
        .join(', ');
};

const getTermIds = (terms?: string): string[] | null => {
    if (!terms) return null;
    const termIds: string[] = [];
    terms.split(/;(?=GP0)/g).forEach(term => {
        const match = term.match(/#([0-9a-fA-F-]+)/);
        if (match) termIds.push(match[1]);
    });
    return termIds;
};

const getJobTypeLabel = (jobTypes: any[], termId: string, language: Language): string => {
    const jobType = jobTypes.filter(j => j.id === termId)[0];
    const label = jobType?.labels?.filter((l: any) => l.languageTag === language)[0];
    return label?.name ?? 'N/A';
};

const getJobTypeText = (jobType: string | undefined, language: Language): string => {
    const termIds = getTermIds(jobType);
    const jobTypes = Globals.getJobTypes();

    if (termIds && Array.isArray(jobTypes)) {
        return termIds.map(id => getJobTypeLabel(jobTypes, id, language)).join(', ');
    }

    console.warn('Unable to translate JobType... defaulting to display language.');
    return termLabelDefaultLanguage(jobType);
};

const getSearchWords = (): string[] => (Globals.searchQuery ?? '')
        .split('path:')[0]
        .replace(/[*]/g, '')
        .trim()
        .split(/\s+/)
        .map(w => w.replace(/^["']|["']$/g, ''))
        .filter(Boolean);

// Wraps matches in <mark>. Only matches at the start of a word, since that's how PnP search matches. 
const highlightText = (text: string = '', words: string[]): IHighlightResult => {
    if (words.length === 0) return { html: text, matchCount: 0 };

    const lowerText = text.toLowerCase();
    const matches: Array<{ start: number; end: number }> = [];

    words.forEach(word => {
        const lowerWord = word.toLowerCase();
        let index = lowerText.indexOf(lowerWord);

        while (index !== -1) {
            const isWordStart = index === 0 || !/[a-z0-9]/i.test(lowerText[index - 1]);
            if (isWordStart) {
                matches.push({ start: index, end: index + lowerWord.length });
            }
            index = lowerText.indexOf(lowerWord, index + 1);
        }
    });

    // Sort, then drop duplicates/overlaps
    matches.sort((a, b) => a.start - b.start);
    const filtered: Array<{ start: number; end: number }> = [];
    matches.forEach(match => {
        const last = filtered[filtered.length - 1];
        if (!last || match.start >= last.end) filtered.push(match);
    });

    // Insert tags right to left so earlier indices stay valid
    let html = text;
    for (let i = filtered.length - 1; i >= 0; i--) {
        const { start, end } = filtered[i];
        html = html.slice(0, start) + '<mark>' + html.slice(start, end) + '</mark>' + html.slice(end);
    }

    return { html, matchCount: filtered.length };
};

const JobCardComponent: React.FC<ICustomComponentProps> = (props) => {
    const theme = useTheme();
    const lang = Globals.getLanguage();
    const isFrench = lang === Language.French;
    const strings = SelectLanguage(lang);

    const jobId = props.path && props.path.split('ID=').length === 2 ? props.path.split('ID=')[1] : 'null';
    const jobUrl = `${Globals.jobOpportunityPageUrl}${jobId}`;

    const searchWords = getSearchWords();
    const title = highlightText(isFrench ? props.jobTitleFr : props.jobTitleEn, searchWords);
    const description = highlightText(isFrench ? props.jobDescriptionFr : props.jobDescriptionEn, searchWords);

    const hasSearchQuery = !!Globals.searchQuery && Globals.searchQuery.trim().length > 0;
    const showSearchTermFound = hasSearchQuery && title.matchCount + description.matchCount === 0;

    const expired = !props.applicationDeadlineDate || new Date() >= props.applicationDeadlineDate;

    return (
        <Link
            href={jobUrl}
            target='_blank'
            className='noLinkStyle'
            id={'jobView-' + jobId}
        >
            <div
                className={expired ? 'jobcard expiredJobCard' : 'jobcard'}
                style={{ border: `1px solid ${theme.palette.themePrimary}` }}
            >
                {expired &&
                    <div className='expiredBanner'>
                        <p role="status" aria-live="polite">{strings.jobExpired}</p>
                    </div>
                }
                <div className="card-content">
                    <h3 style={{ color: theme.palette.themePrimary, overflow: 'hidden', maxWidth: '350px' }}>
                        <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(title.html) }} />
                    </h3>
                    <div className="sub">
                        {showSearchTermFound &&
                            <div className="searchTermFound">
                                <mark><b>{strings.searchTermFound}</b></mark>
                            </div>
                        }
                        <div>
                            <b>{strings.classificationLevel}</b>: {isFrench ? props.classificationCodeFr : props.classificationCodeEn}-{props.classificationLevel}
                        </div>
                        <div>
                            <b>{strings.opportunityType}</b>: {getJobTypeText(props.jobType, lang)}
                        </div>
                        <div>
                            <b>{strings.duration}</b>: {!props.durationQuantity ? strings.undetermined : `${props.durationQuantity} ${isFrench ? props.durationFr : props.durationEn}`}
                        </div>
                    </div>
                    <div className="description">
                        <b>{strings.description}</b>: <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description.html) }} />
                    </div>
                    <div className="sub">
                        <div>
                            <b>{strings.location}</b>: {(isFrench ? props.cityFr : props.cityEn) || strings.remote}
                        </div>
                        <div>
                            <b>{strings.deadline}</b>: {formatDeadline(props.applicationDeadlineDate)}
                        </div>
                    </div>
                    <div className="contact">
                        <div className="profile">
                            <div>{getContactNameInitials(props.contactName)}</div>
                        </div>
                        <div className="info">
                            <div>{props.contactName}</div>
                            <div>{props.applyEmail ? props.applyEmail : props.contactEmail}</div>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
};

export class MyCustomComponentWebComponent extends BaseWebComponent {

    public async connectedCallback() {
        const attr = (name: string): string | undefined => this.getAttribute(name) ?? undefined;

        const deadlineAttr = attr('application-deadline-date');
        const deadline = deadlineAttr ? new Date(deadlineAttr + ' UTC') : undefined;

        const props: ICustomComponentProps = {
            path: attr('path') || '',
            applicationDeadlineDate: deadline && !isNaN(deadline.getTime()) ? deadline : undefined,
            cityEn: attr('city-en'),
            cityFr: attr('city-fr'),
            classificationLevel: attr('classification-level'),
            classificationCodeEn: attr('classification-code-en'),
            classificationCodeFr: attr('classification-code-fr'),
            contactEmail: attr('contact-email'),
            contactName: attr('contact-name'),
            durationEn: attr('duration-en'),
            durationFr: attr('duration-fr'),
            durationQuantity: attr('duration-quantity'),
            jobDescriptionEn: attr('job-description-en'),
            jobDescriptionFr: attr('job-description-fr'),
            jobTitleEn: attr('job-title-en'),
            jobTitleFr: attr('job-title-fr'),
            jobType: attr('job-type'),
            applyEmail: attr('apply-email')
        };

        ReactDOM.render(<JobCardComponent {...props} />, this);
    }

    protected onDispose(): void {
        ReactDOM.unmountComponentAtNode(this);
    }
}