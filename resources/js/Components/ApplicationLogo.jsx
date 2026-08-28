export default function ApplicationLogo({className = '', ...props}) {
    return (
        <img
            src="/logowithword.png"
            alt="Company logo"
            className={className}
            {...props}
        />
    );
}
