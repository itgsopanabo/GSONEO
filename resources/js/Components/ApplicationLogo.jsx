export default function ApplicationLogo({className = '', ...props}) {
    return (
        <img
            src="/icon.png"
            alt="Company logo"
            className={className}
            {...props}
        />
    );
}
